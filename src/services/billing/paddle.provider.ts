/**
 * Paddle Billing adapter (B3).
 */

import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { ValidationError } from "@/lib/api/response";
import { PlanVisibility, PlanVersionStatus } from "@prisma/client";
import {
  isPaddleConfigured,
  paddleEnvironment,
  paddleFetch,
  verifyPaddleSignature,
} from "@/services/billing/paddle-client";
import type {
  MappedBillingEvent,
  PaymentProvider,
} from "@/services/billing/provider-types";
import { logger } from "@/lib/logger";

type PaddleData<T> = { data: T };

export class PaddleProvider implements PaymentProvider {
  readonly id = "PADDLE" as const;

  private assertConfigured() {
    if (!isPaddleConfigured()) {
      throw new ValidationError("Paddle is not configured");
    }
  }

  async createCustomer(input: {
    organizationId: string;
    email: string;
    name: string;
  }) {
    this.assertConfigured();
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
    });
    const envName = paddleEnvironment();
    if (org.paddleCustomerId && org.paddleCustomerEnv === envName) {
      return { externalCustomerId: org.paddleCustomerId };
    }

    const res = await paddleFetch<PaddleData<{ id: string }>>("/customers", {
      method: "POST",
      json: {
        email: input.email,
        name: input.name,
        custom_data: { organizationId: input.organizationId },
      },
    });

    await prisma.organization.update({
      where: { id: input.organizationId },
      data: {
        paddleCustomerId: res.data.id,
        paddleCustomerEnv: envName,
        billingEmail: input.email,
      },
    });

    return { externalCustomerId: res.data.id };
  }

  async syncProductAndPrices(input: {
    planId: string;
    planVersionId: string;
    reason?: string;
  }) {
    this.assertConfigured();
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

    const envName = paddleEnvironment();
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
    this.assertConfigured();
    const pack = await prisma.topUpPack.findUnique({
      where: { id: input.topUpPackId },
    });
    if (!pack || pack.archivedAt) throw new ValidationError("Pack not found");
    const envName = paddleEnvironment();

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
        environment: paddleEnvironment(),
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
    this.assertConfigured();
    if (!env.PAYMENTS_ENABLED) {
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
    });
    const customer = await this.createCustomer({
      organizationId: input.organizationId,
      email: input.customerEmail,
      name: org.name,
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
          paddleEnv: paddleEnvironment(),
        },
        checkout: {
          url: input.successUrl,
        },
      },
    });

    return {
      mode: "paddle_overlay" as const,
      transactionId: tx.data.id,
      clientToken: env.PADDLE_CLIENT_TOKEN!,
    };
  }

  async createTopUpCheckout(input: {
    organizationId: string;
    topUpPackId: string;
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    this.assertConfigured();
    if (!env.PAYMENTS_ENABLED) {
      throw new ValidationError("Payments are not enabled yet");
    }
    const map = await prisma.providerPriceMap.findFirst({
      where: {
        provider: "PADDLE",
        environment: paddleEnvironment(),
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
        environment: paddleEnvironment(),
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
          paddleEnv: paddleEnvironment(),
        },
        checkout: { url: input.successUrl },
      },
    });

    return {
      mode: "paddle_overlay" as const,
      transactionId: tx.data.id,
      clientToken: env.PADDLE_CLIENT_TOKEN!,
    };
  }

  async createPortalSession(input: {
    organizationId: string;
    returnUrl: string;
  }) {
    this.assertConfigured();
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
    });
    if (!org.paddleCustomerId || org.paddleCustomerEnv !== paddleEnvironment()) {
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
    this.assertConfigured();
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
    this.assertConfigured();
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
    this.assertConfigured();
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
    const secret = env.PADDLE_WEBHOOK_SECRET;
    if (!secret) throw new ValidationError("PADDLE_WEBHOOK_SECRET missing");
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

    if (!organizationId) {
      return { type: "unmatched", reason: "missing organizationId in custom_data" };
    }

    if (eventType === "transaction.completed") {
      const kind = custom.kind as string | undefined;
      const txId = (data.id as string) || "";
      if (kind === "topup") {
        return {
          type: "topup_paid",
          organizationId,
          topUpPackId: String(custom.topUpPackId || ""),
          transactionId: txId,
          credits: Number(custom.credits || 0),
          occurredAt,
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
            environment: paddleEnvironment(),
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
      return {
        type: "refund_or_chargeback",
        organizationId,
        transactionId: String(data.transaction_id || ""),
        isChargeback: /chargeback|dispute/i.test(action),
        occurredAt,
      };
    }

    return { type: "unmatched", reason: `unhandled event ${eventType}` };
  }

  async testConnection() {
    try {
      this.assertConfigured();
      await paddleFetch("/event-types");
      return {
        ok: true,
        message: `Paddle ${paddleEnvironment()} OK`,
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
