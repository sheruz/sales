/**
 * Paddle Billing adapter (B3).
 */

import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { ValidationError } from "@/lib/api/response";
import { PlanVisibility, PlanVersionStatus } from "@prisma/client";
import {
  getPaddleRuntime,
  isPaddleConfigured,
  paddleFetch,
  verifyPaddleSignature,
} from "@/services/billing/paddle-client";
import { paymentConfigService } from "@/services/billing/payment-config.service";
import type {
  MappedBillingEvent,
  PaymentProvider,
} from "@/services/billing/provider-types";
import { logger } from "@/lib/logger";
import { parsePaddleMoney } from "@/lib/billing/paddle-amounts";

/** Catalog / seller-account noise — never route to a tenant */
const PADDLE_NOISE_PREFIXES = [
  "price.",
  "product.",
  "api_key.",
  "client_token.",
  "discount.",
  "notification_setting.",
  "report.",
];
const PADDLE_NOISE_EXACT = new Set([
  "transaction.created",
  "transaction.updated",
  "transaction.ready",
  "transaction.paid",
  "customer.created",
  "customer.updated",
  "address.created",
  "address.updated",
  "business.created",
  "business.updated",
  "subscription.trialing",
  "subscription.activated",
]);

function isPaddleNoiseEvent(eventType: string): boolean {
  if (!eventType) return false;
  if (PADDLE_NOISE_EXACT.has(eventType)) return true;
  return PADDLE_NOISE_PREFIXES.some((p) => eventType.startsWith(p));
}

type PaddleData<T> = { data: T };

export class PaddleProvider implements PaymentProvider {
  readonly id = "PADDLE" as const;

  private async assertConfigured() {
    if (!(await isPaddleConfigured())) {
      throw new ValidationError("Paddle is not configured");
    }
  }

  private async envName() {
    const rt = await getPaddleRuntime();
    return rt.environment;
  }

  /**
   * Bind an existing Paddle customer id to this org (same env).
   * Rejects if another org already owns that id.
   */
  private async adoptCustomerId(input: {
    organizationId: string;
    customerId: string;
    email: string;
    name: string;
    envName: string;
  }) {
    const taken = await prisma.organization.findFirst({
      where: {
        paddleCustomerId: input.customerId,
        paddleCustomerEnv: input.envName,
        id: { not: input.organizationId },
      },
      select: { id: true, name: true },
    });
    if (taken) {
      throw new ValidationError(
        `This billing email is already linked to another workspace (${taken.name}). Use a different billing email.`
      );
    }

    await this.patchCustomer(input.customerId, {
      email: input.email,
      name: input.name,
      organizationId: input.organizationId,
    });

    await prisma.organization.update({
      where: { id: input.organizationId },
      data: {
        paddleCustomerId: input.customerId,
        paddleCustomerEnv: input.envName,
        billingEmail: input.email,
      },
    });

    return { externalCustomerId: input.customerId };
  }

  /** Look up Paddle customer by email (list API). */
  private async findCustomerIdByEmail(email: string): Promise<string | null> {
    try {
      const res = await paddleFetch<{
        data: Array<{ id: string; email?: string }>;
      }>(`/customers?email=${encodeURIComponent(email)}`);
      const match = res.data?.find(
        (c) => (c.email || "").toLowerCase() === email.toLowerCase()
      );
      return match?.id || res.data?.[0]?.id || null;
    } catch (err) {
      logger.warn("paddle customer email lookup failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  private parseExistingCustomerIdFromError(err: unknown): string | null {
    const msg = err instanceof Error ? err.message : String(err);
    // detail: "customer email conflicts with customer of id ctm_..."
    const m = msg.match(/customer of id\s+(ctm_[a-z0-9]+)/i);
    if (m?.[1]) return m[1];
    const m2 = msg.match(/(ctm_[a-z0-9]+)/i);
    return m2?.[1] || null;
  }

  async createCustomer(input: {
    organizationId: string;
    email: string;
    name: string;
  }) {
    await this.assertConfigured();
    const email = input.email.trim().toLowerCase();
    if (!email) {
      throw new ValidationError("Billing email is required for Paddle customer");
    }
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
    });
    const envName = await this.envName();

    // Already linked in this env → reuse (never create a second Paddle customer)
    if (org.paddleCustomerId && org.paddleCustomerEnv === envName) {
      const clash = await prisma.organization.findFirst({
        where: {
          id: { not: input.organizationId },
          paddleCustomerId: org.paddleCustomerId,
          paddleCustomerEnv: envName,
        },
        select: { id: true, name: true },
      });
      if (clash) {
        logger.error("paddle customer shared across orgs — clearing", {
          organizationId: input.organizationId,
          clashOrgId: clash.id,
          customerId: org.paddleCustomerId,
        });
        await prisma.organization.update({
          where: { id: input.organizationId },
          data: { paddleCustomerId: null, paddleCustomerEnv: null },
        });
      } else {
        await this.patchCustomer(org.paddleCustomerId, {
          email,
          name: input.name,
          organizationId: input.organizationId,
        });
        if (org.billingEmail !== email) {
          await prisma.organization.update({
            where: { id: input.organizationId },
            data: { billingEmail: email },
          });
        }
        return { externalCustomerId: org.paddleCustomerId };
      }
    }

    // Org lost its stored id (or first checkout after Beenish paid): email already on Paddle
    const existingId = await this.findCustomerIdByEmail(email);
    if (existingId) {
      return this.adoptCustomerId({
        organizationId: input.organizationId,
        customerId: existingId,
        email,
        name: input.name,
        envName,
      });
    }

    try {
      const res = await paddleFetch<
        PaddleData<{ id: string; email?: string }>
      >("/customers", {
        method: "POST",
        json: {
          email,
          name: input.name,
          custom_data: { organizationId: input.organizationId },
        },
      });

      return this.adoptCustomerId({
        organizationId: input.organizationId,
        customerId: res.data.id,
        email,
        name: input.name,
        envName,
      });
    } catch (err) {
      // Race / list miss: Paddle 409 customer_already_exists → adopt that id
      const conflictId = this.parseExistingCustomerIdFromError(err);
      if (conflictId) {
        logger.info("paddle customer_already_exists — adopting", {
          organizationId: input.organizationId,
          customerId: conflictId,
          email,
        });
        return this.adoptCustomerId({
          organizationId: input.organizationId,
          customerId: conflictId,
          email,
          name: input.name,
          envName,
        });
      }
      throw err;
    }
  }

  async getCustomer(customerId: string) {
    await this.assertConfigured();
    const res = await paddleFetch<
      PaddleData<{ id: string; email: string; name?: string | null; custom_data?: Record<string, unknown> }>
    >(`/customers/${customerId}`);
    return res.data;
  }

  private async patchCustomer(
    customerId: string,
    input: { email: string; name: string; organizationId: string }
  ) {
    try {
      await paddleFetch(`/customers/${customerId}`, {
        method: "PATCH",
        json: {
          email: input.email,
          name: input.name,
          custom_data: { organizationId: input.organizationId },
        },
      });
    } catch (err) {
      logger.warn("paddle customer patch failed", {
        customerId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Sync org billing contact fields onto the Paddle customer (create if missing).
   */
  async syncCustomerDetails(input: {
    organizationId: string;
    email: string;
    name: string;
    address?: string | null;
    country?: string | null;
    taxId?: string | null;
  }) {
    await this.assertConfigured();
    const customer = await this.createCustomer({
      organizationId: input.organizationId,
      email: input.email,
      name: input.name,
    });

    // Paddle business tax identifiers / address via customer address API when country set
    if (input.country?.trim()) {
      try {
        const lines = (input.address || "")
          .split(/\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        await paddleFetch(
          `/customers/${customer.externalCustomerId}/addresses`,
          {
            method: "POST",
            json: {
              country_code: input.country.trim().toUpperCase(),
              first_line: lines[0] || "—",
              second_line: lines[1] || undefined,
              city: lines[2] || undefined,
              postal_code: lines[3] || undefined,
            },
          }
        ).catch(() => null);
      } catch {
        // non-fatal — email/name already synced
      }
    }

    if (input.taxId?.trim()) {
      try {
        await paddleFetch(
          `/customers/${customer.externalCustomerId}/businesses`,
          {
            method: "POST",
            json: {
              name: input.name,
              tax_identifier: input.taxId.trim(),
              contacts: [{ email: input.email }],
            },
          }
        ).catch(() => null);
      } catch {
        // non-fatal
      }
    }

    return customer;
  }

  async syncProductAndPrices(input: {
    planId: string;
    planVersionId: string;
    reason?: string;
  }) {
    await this.assertConfigured();
    const version = await prisma.planVersion.findUnique({
      where: { id: input.planVersionId },
      include: { plan: true },
    });
    if (!version) throw new ValidationError("Plan version not found");
    const plan = version.plan;
    if (
      plan.visibility === PlanVisibility.INTERNAL ||
      plan.code === "OWNER" ||
      plan.code === "COMPLIMENTARY" ||
      plan.archivedAt
    ) {
      logger.info("paddle sync skipped (internal/archived)", {
        planId: plan.id,
        code: plan.code,
      });
      return { ok: true };
    }

    const envName = await this.envName();
    // Reuse product if we already have a map for this plan's any version
    let productId: string | null = null;
    const existing = await prisma.providerPriceMap.findFirst({
      where: {
        provider: "PADDLE",
        environment: envName,
        planVersion: { planId: plan.id },
        active: true,
      },
    });
    if (existing) productId = existing.externalProductId;

    if (!productId) {
      const created = await paddleFetch<PaddleData<{ id: string }>>("/products", {
        method: "POST",
        json: {
          name: plan.name,
          description: plan.description || plan.name,
          tax_category: "standard",
          custom_data: { planId: plan.id },
        },
      });
      productId = created.data.id;
    } else {
      await paddleFetch(`/products/${productId}`, {
        method: "PATCH",
        json: {
          name: plan.name,
          description: plan.description || plan.name,
        },
      }).catch(() => null);
    }

    const priceIds: string[] = [];
    for (const interval of ["MONTHLY", "YEARLY"] as const) {
      const unit =
        interval === "MONTHLY"
          ? Number(version.priceMonthly)
          : Number(version.priceYearly);
      const amountCents = Math.round(unit * 100);
      const created = await paddleFetch<PaddleData<{ id: string }>>("/prices", {
        method: "POST",
        json: {
          product_id: productId,
          description: `${plan.name} ${interval.toLowerCase()}`,
          unit_price: {
            amount: String(amountCents),
            currency_code: version.currency || "USD",
          },
          billing_cycle: {
            interval: interval === "MONTHLY" ? "month" : "year",
            frequency: 1,
          },
          tax_mode: "account_setting",
          custom_data: {
            planId: plan.id,
            planVersionId: version.id,
            interval,
          },
        },
      });
      const priceId = created.data.id;
      priceIds.push(priceId);

      const prior = await prisma.providerPriceMap.findFirst({
        where: {
          provider: "PADDLE",
          environment: envName,
          planVersionId: version.id,
          interval,
        },
      });
      if (prior) {
        await prisma.providerPriceMap.update({
          where: { id: prior.id },
          data: {
            active: false,
          },
        });
      }
      await prisma.providerPriceMap.create({
        data: {
          provider: "PADDLE",
          environment: envName,
          interval,
          planVersionId: version.id,
          externalProductId: productId!,
          externalPriceId: priceId,
          active: true,
        },
      });
    }

    logger.info("paddle syncProductAndPrices ok", {
      planId: plan.id,
      planVersionId: version.id,
      environment: envName,
      reason: input.reason ?? null,
    });
    return { ok: true, productId: productId!, priceIds };
  }

  async syncTopUpPack(input: { topUpPackId: string }) {
    await this.assertConfigured();
    const pack = await prisma.topUpPack.findUnique({
      where: { id: input.topUpPackId },
    });
    if (!pack || pack.archivedAt) throw new ValidationError("Pack not found");
    const envName = await this.envName();

    let productId: string | null = null;
    const existing = await prisma.providerPriceMap.findFirst({
      where: {
        provider: "PADDLE",
        environment: envName,
        topUpPackId: pack.id,
        active: true,
      },
    });
    if (existing) productId = existing.externalProductId;

    if (!productId) {
      const created = await paddleFetch<PaddleData<{ id: string }>>("/products", {
        method: "POST",
        json: {
          name: pack.name,
          tax_category: "standard",
          custom_data: { topUpPackId: pack.id },
        },
      });
      productId = created.data.id;
    }

    const amountCents = Math.round(Number(pack.price) * 100);
    const price = await paddleFetch<PaddleData<{ id: string }>>("/prices", {
      method: "POST",
      json: {
        product_id: productId,
        description: pack.name,
        unit_price: {
          amount: String(amountCents),
          currency_code: pack.currency || "USD",
        },
        tax_mode: "account_setting",
        custom_data: { topUpPackId: pack.id, interval: "ONE_TIME" },
      },
    });

    if (existing) {
      await prisma.providerPriceMap.update({
        where: { id: existing.id },
        data: { active: false },
      });
    }
    await prisma.providerPriceMap.create({
      data: {
        provider: "PADDLE",
        environment: envName,
        interval: "ONE_TIME",
        topUpPackId: pack.id,
        externalProductId: productId!,
        externalPriceId: price.data.id,
        active: true,
      },
    });
    return { ok: true, priceId: price.data.id };
  }

  private async resolvePriceId(
    planVersionId: string,
    interval: "MONTHLY" | "YEARLY"
  ) {
    const map = await prisma.providerPriceMap.findFirst({
      where: {
        provider: "PADDLE",
        environment: await this.envName(),
        planVersionId,
        interval,
        active: true,
      },
    });
    if (!map) {
      throw new ValidationError(
        "Plan is not synced to Paddle for this environment. Use Resync on the package."
      );
    }
    return map;
  }

  async createCheckout(input: {
    organizationId: string;
    planVersionId: string;
    interval: "MONTHLY" | "YEARLY";
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    await this.assertConfigured();
    if (!(await paymentConfigService.isPaymentsLive())) {
      throw new ValidationError("Payments are not enabled yet");
    }
    if (env.PLATFORM_OWNER_ORG_ID === input.organizationId) {
      throw new ValidationError("Platform owner is never billed");
    }

    const version = await prisma.planVersion.findUnique({
      where: { id: input.planVersionId },
      include: { plan: true },
    });
    if (
      !version ||
      version.status !== PlanVersionStatus.PUBLISHED ||
      version.plan.visibility !== PlanVisibility.PUBLIC ||
      version.plan.archivedAt
    ) {
      throw new ValidationError("Plan version is not available for checkout");
    }

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
      select: {
        name: true,
        billingContactName: true,
      },
    });
    const customerName =
      org.billingContactName?.trim() || org.name;
    const customer = await this.createCustomer({
      organizationId: input.organizationId,
      email: input.customerEmail,
      name: customerName,
    });
    const price = await this.resolvePriceId(input.planVersionId, input.interval);

    const tx = await paddleFetch<PaddleData<{ id: string }>>("/transactions", {
      method: "POST",
      json: {
        items: [{ price_id: price.externalPriceId, quantity: 1 }],
        customer_id: customer.externalCustomerId,
        currency_code: "USD",
        collection_mode: "automatic",
        custom_data: {
          organizationId: input.organizationId,
          planId: version.planId,
          planVersionId: version.id,
          interval: input.interval,
          kind: "subscription",
          paddleEnv: await this.envName(),
        },
        checkout: {
          url: input.successUrl,
        },
      },
    });

    return {
      mode: "paddle_overlay" as const,
      transactionId: tx.data.id,
      clientToken: (await getPaddleRuntime()).clientToken,
    };
  }

  async createTopUpCheckout(input: {
    organizationId: string;
    topUpPackId: string;
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    await this.assertConfigured();
    if (!(await paymentConfigService.isPaymentsLive())) {
      throw new ValidationError("Payments are not enabled yet");
    }
    const map = await prisma.providerPriceMap.findFirst({
      where: {
        provider: "PADDLE",
        environment: await this.envName(),
        topUpPackId: input.topUpPackId,
        interval: "ONE_TIME",
        active: true,
      },
    });
    if (!map) {
      await this.syncTopUpPack({ topUpPackId: input.topUpPackId });
    }
    const price = await prisma.providerPriceMap.findFirstOrThrow({
      where: {
        provider: "PADDLE",
        environment: await this.envName(),
        topUpPackId: input.topUpPackId,
        interval: "ONE_TIME",
        active: true,
      },
    });
    const pack = await prisma.topUpPack.findUniqueOrThrow({
      where: { id: input.topUpPackId },
    });
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
    });
    const customer = await this.createCustomer({
      organizationId: input.organizationId,
      email: input.customerEmail,
      name: org.name,
    });

    const tx = await paddleFetch<PaddleData<{ id: string }>>("/transactions", {
      method: "POST",
      json: {
        items: [{ price_id: price.externalPriceId, quantity: 1 }],
        customer_id: customer.externalCustomerId,
        currency_code: "USD",
        collection_mode: "automatic",
        custom_data: {
          organizationId: input.organizationId,
          topUpPackId: pack.id,
          kind: "topup",
          credits: pack.credits,
          paddleEnv: await this.envName(),
        },
        checkout: { url: input.successUrl },
      },
    });

    return {
      mode: "paddle_overlay" as const,
      transactionId: tx.data.id,
      clientToken: (await getPaddleRuntime()).clientToken,
    };
  }

  async createPortalSession(input: {
    organizationId: string;
    returnUrl: string;
  }) {
    await this.assertConfigured();
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
    });
    if (!org.paddleCustomerId || org.paddleCustomerEnv !== await this.envName()) {
      throw new ValidationError("No Paddle customer for this environment");
    }
    // Paddle Billing customer portal session
    const res = await paddleFetch<PaddleData<{ urls: { general: { overview: string } } }>>(
      `/customers/${org.paddleCustomerId}/portal-sessions`,
      {
        method: "POST",
        json: {},
      }
    );
    const url =
      (res.data as { urls?: { general?: { overview?: string } } })?.urls?.general
        ?.overview || input.returnUrl;
    return { url };
  }

  async changeSubscription(input: {
    organizationId: string;
    planVersionId: string;
    interval: "MONTHLY" | "YEARLY";
    proration: boolean;
    effective: "immediate" | "period_end";
  }) {
    await this.assertConfigured();
    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: input.organizationId },
    });
    if (!sub.externalSubscriptionId) {
      throw new ValidationError("No active Paddle subscription");
    }
    const price = await this.resolvePriceId(input.planVersionId, input.interval);
    await paddleFetch(`/subscriptions/${sub.externalSubscriptionId}`, {
      method: "PATCH",
      json: {
        items: [{ price_id: price.externalPriceId, quantity: 1 }],
        proration_billing_mode: input.proration
          ? "prorated_immediately"
          : "do_not_bill",
        scheduled_change:
          input.effective === "period_end"
            ? { action: "update", effective_at: "next_billing_period" }
            : undefined,
        custom_data: {
          organizationId: input.organizationId,
          planVersionId: input.planVersionId,
          interval: input.interval,
        },
      },
    });
    return { ok: true };
  }

  async cancelSubscription(input: {
    organizationId: string;
    atPeriodEnd: boolean;
  }) {
    await this.assertConfigured();
    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: input.organizationId },
    });
    if (!sub.externalSubscriptionId) {
      throw new ValidationError("No active Paddle subscription");
    }
    if (input.atPeriodEnd) {
      await paddleFetch(`/subscriptions/${sub.externalSubscriptionId}`, {
        method: "PATCH",
        json: {
          scheduled_change: { action: "cancel", effective_at: "next_billing_period" },
        },
      });
    } else {
      await paddleFetch(`/subscriptions/${sub.externalSubscriptionId}/cancel`, {
        method: "POST",
        json: { effective_from: "immediately" },
      });
    }
    return { ok: true };
  }

  async resumeSubscription(input: { organizationId: string }) {
    await this.assertConfigured();
    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: input.organizationId },
    });
    if (!sub.externalSubscriptionId) {
      throw new ValidationError("No active Paddle subscription");
    }
    await paddleFetch(`/subscriptions/${sub.externalSubscriptionId}`, {
      method: "PATCH",
      json: { scheduled_change: null },
    });
    return { ok: true };
  }

  async verifyWebhook(input: {
    rawBody: string;
    signatureHeader: string | null;
  }) {
    const rt = await getPaddleRuntime();
    const secret = rt.webhookSecret;
    if (!secret) throw new ValidationError("Paddle webhook secret missing");
    const ok = await verifyPaddleSignature(
      input.rawBody,
      input.signatureHeader,
      secret
    );
    if (!ok) throw new ValidationError("Invalid Paddle signature");

    const payload = JSON.parse(input.rawBody) as {
      event_id?: string;
      event_type?: string;
      occurred_at?: string;
      data?: unknown;
    };
    if (!payload.event_id || !payload.event_type) {
      throw new ValidationError("Invalid Paddle event payload");
    }
    return {
      eventId: payload.event_id,
      eventType: payload.event_type,
      payload,
      occurredAt: payload.occurred_at
        ? new Date(payload.occurred_at)
        : new Date(),
    };
  }

  async mapEvent(payload: unknown): Promise<MappedBillingEvent> {
    const body = payload as {
      event_type?: string;
      occurred_at?: string;
      data?: Record<string, unknown>;
    };
    const data = body.data || {};
    const custom =
      (data.custom_data as Record<string, unknown> | null) ||
      ((data.transaction as { custom_data?: Record<string, unknown> } | undefined)
        ?.custom_data) ||
      {};
    const organizationId =
      (custom.organizationId as string | undefined) ||
      (data.custom_data as { organizationId?: string } | undefined)
        ?.organizationId;
    const occurredAt = body.occurred_at
      ? new Date(body.occurred_at)
      : new Date();
    const eventType = body.event_type || "";

    // Skip catalog/auth noise before org routing (avoids false "unmatched" pile-up)
    if (isPaddleNoiseEvent(eventType)) {
      return { type: "skipped", reason: `noise event ${eventType}` };
    }

    if (!organizationId) {
      return { type: "unmatched", reason: "missing organizationId in custom_data" };
    }

    if (eventType === "transaction.completed") {
      const kind = custom.kind as string | undefined;
      const txId = (data.id as string) || "";
      const money = parsePaddleMoney(payload);
      if (kind === "topup") {
        return {
          type: "topup_paid",
          organizationId,
          topUpPackId: String(custom.topUpPackId || ""),
          transactionId: txId,
          credits: Number(custom.credits || 0),
          occurredAt,
          amount: money.amount,
          taxAmount: money.tax,
          feeAmount: money.fee,
          netAmount: money.net,
          currency: money.currency,
        };
      }
      // subscription first payment or renewal
      const subId =
        (data.subscription_id as string) ||
        ((data.subscription as { id?: string } | undefined)?.id ?? "");
      const items = (data.items as Array<{ price?: { id?: string } }>) || [];
      const priceId = items[0]?.price?.id;
      let planVersionId = custom.planVersionId as string | undefined;
      let interval = (custom.interval as "MONTHLY" | "YEARLY") || "MONTHLY";
      if (priceId) {
        const map = await prisma.providerPriceMap.findFirst({
          where: {
            provider: "PADDLE",
            environment: await this.envName(),
            externalPriceId: priceId,
            active: true,
          },
        });
        if (map?.planVersionId) {
          planVersionId = map.planVersionId;
          if (map.interval === "MONTHLY" || map.interval === "YEARLY") {
            interval = map.interval;
          }
        }
      }
      if (!planVersionId) {
        return { type: "unmatched", reason: "no planVersion for price" };
      }
      const billingPeriod = data.billing_period as
        | { starts_at?: string; ends_at?: string }
        | undefined;
      const periodStart = billingPeriod?.starts_at
        ? new Date(billingPeriod.starts_at)
        : new Date();
      const periodEnd = billingPeriod?.ends_at
        ? new Date(billingPeriod.ends_at)
        : new Date(periodStart.getTime() + 30 * 86_400_000);

      // If subscription already active with same period → renewal
      const existing = await prisma.subscription.findUnique({
        where: { organizationId },
      });
      if (
        existing?.status === "ACTIVE" &&
        existing.externalSubscriptionId &&
        existing.currentPeriodEnd &&
        existing.currentPeriodEnd < periodEnd
      ) {
        return {
          type: "renewal_paid",
          organizationId,
          externalSubscriptionId: subId || existing.externalSubscriptionId,
          transactionId: txId,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          occurredAt,
          amount: money.amount,
          taxAmount: money.tax,
          feeAmount: money.fee,
          netAmount: money.net,
          currency: money.currency,
        };
      }

      return {
        type: "subscription_activated",
        organizationId,
        planVersionId,
        interval,
        externalCustomerId: String(data.customer_id || ""),
        externalSubscriptionId: subId,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        transactionId: txId,
        amount: money.amount,
        taxAmount: money.tax,
        feeAmount: money.fee,
        netAmount: money.net,
        currency: money.currency,
      };
    }

    if (
      eventType === "subscription.created" ||
      eventType === "subscription.updated" ||
      eventType === "subscription.resumed"
    ) {
      return {
        type: "subscription_updated",
        organizationId,
        externalSubscriptionId: String(data.id || ""),
        planVersionId: custom.planVersionId as string | undefined,
        interval: custom.interval as "MONTHLY" | "YEARLY" | undefined,
        status: String(data.status || ""),
        cancelAtPeriodEnd: Boolean(
          (data.scheduled_change as { action?: string } | null)?.action ===
            "cancel"
        ),
        currentPeriodStart: data.current_billing_period
          ? new Date(
              (data.current_billing_period as { starts_at: string }).starts_at
            )
          : undefined,
        currentPeriodEnd: data.current_billing_period
          ? new Date(
              (data.current_billing_period as { ends_at: string }).ends_at
            )
          : undefined,
        occurredAt,
      };
    }

    if (
      eventType === "subscription.canceled" ||
      eventType === "subscription.past_due"
    ) {
      if (eventType === "subscription.past_due") {
        return {
          type: "payment_failed",
          organizationId,
          externalSubscriptionId: String(data.id || ""),
          occurredAt,
        };
      }
      return {
        type: "subscription_canceled",
        organizationId,
        externalSubscriptionId: String(data.id || ""),
        occurredAt,
      };
    }

    if (eventType === "transaction.payment_failed") {
      return {
        type: "payment_failed",
        organizationId,
        externalSubscriptionId: String(data.subscription_id || ""),
        occurredAt,
      };
    }

    if (eventType === "adjustment.created") {
      const action = String(data.action || "");
      const money = parsePaddleMoney(payload);
      return {
        type: "refund_or_chargeback",
        organizationId,
        transactionId: String(data.transaction_id || ""),
        isChargeback: /chargeback|dispute/i.test(action),
        occurredAt,
        amount: money.amount,
        taxAmount: money.tax,
        feeAmount: money.fee,
        netAmount: money.net,
        currency: money.currency,
      };
    }

    // Noise / informational — not a routing failure
    return { type: "skipped", reason: `unhandled event ${eventType}` };
  }

  async testConnection() {
    try {
      await this.assertConfigured();
      await paddleFetch("/event-types");
      return {
        ok: true,
        message: `Paddle ${await this.envName()} OK`,
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Paddle connection failed",
      };
    }
  }
}

export const paddleProvider = new PaddleProvider();
