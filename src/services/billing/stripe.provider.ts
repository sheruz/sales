/**
 * Stripe Billing adapter (B3.1) — credentials from PaymentProviderConfig.
 */

import Stripe from "stripe";
import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { ValidationError } from "@/lib/api/response";
import { PlanVisibility, PlanVersionStatus } from "@prisma/client";
import {
  paymentConfigService,
  modeToEnvironment,
} from "@/services/billing/payment-config.service";
import type {
  MappedBillingEvent,
  PaymentProvider,
  ProviderEnvironment,
} from "@/services/billing/provider-types";
import { logger } from "@/lib/logger";

export class StripeProvider implements PaymentProvider {
  readonly id = "STRIPE" as const;

  private async runtime(): Promise<{
    stripe: Stripe;
    environment: ProviderEnvironment;
    webhookSecret: string;
    publishableKey: string;
  }> {
    const cfg = await paymentConfigService.getProviderCredentials("STRIPE");
    if (!cfg?.credentials.secretKey) {
      throw new ValidationError("Stripe is not configured");
    }
    const row = await paymentConfigService.getProviderConfig("STRIPE");
    if (!row?.enabled) {
      throw new ValidationError("Stripe is not enabled");
    }
    return {
      stripe: new Stripe(cfg.credentials.secretKey, {
        apiVersion: "2026-08-26.dahlia",
      }),
      environment: cfg.environment,
      webhookSecret: cfg.credentials.webhookSecret || "",
      publishableKey: cfg.credentials.publishableKey || "",
    };
  }

  async createCustomer(input: {
    organizationId: string;
    email: string;
    name: string;
  }) {
    const { stripe, environment } = await this.runtime();
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
    });
    if (org.stripeCustomerId && org.stripeCustomerEnv === environment) {
      return { externalCustomerId: org.stripeCustomerId };
    }
    const customer = await stripe.customers.create({
      email: input.email,
      name: input.name,
      metadata: { organizationId: input.organizationId },
    });
    await prisma.organization.update({
      where: { id: input.organizationId },
      data: {
        stripeCustomerId: customer.id,
        stripeCustomerEnv: environment,
        billingEmail: input.email,
      },
    });
    return { externalCustomerId: customer.id };
  }

  async syncProductAndPrices(input: {
    planId: string;
    planVersionId: string;
    reason?: string;
  }) {
    const { stripe, environment } = await this.runtime();
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
      return { ok: true };
    }

    let productId: string | null = null;
    const existing = await prisma.providerPriceMap.findFirst({
      where: {
        provider: "STRIPE",
        environment,
        planVersion: { planId: plan.id },
        active: true,
      },
    });
    if (existing) productId = existing.externalProductId;
    else {
      const product = await stripe.products.create({
        name: plan.name,
        metadata: { planId: plan.id },
      });
      productId = product.id;
    }

    const priceIds: string[] = [];
    for (const interval of ["MONTHLY", "YEARLY"] as const) {
      const unitAmount = Math.round(
        Number(
          interval === "YEARLY" ? version.priceYearly : version.priceMonthly
        ) * 100
      );
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: unitAmount,
        currency: (version.currency || "usd").toLowerCase(),
        recurring: {
          interval: interval === "YEARLY" ? "year" : "month",
        },
        metadata: {
          planVersionId: version.id,
          interval,
        },
      });
      priceIds.push(price.id);
      await prisma.providerPriceMap.updateMany({
        where: {
          provider: "STRIPE",
          environment,
          planVersionId: version.id,
          interval,
          active: true,
        },
        data: { active: false },
      });
      await prisma.providerPriceMap.create({
        data: {
          provider: "STRIPE",
          environment,
          interval,
          planVersionId: version.id,
          externalProductId: productId,
          externalPriceId: price.id,
          active: true,
        },
      });
    }
    logger.info("stripe syncProductAndPrices ok", {
      planVersionId: version.id,
      environment,
    });
    return { ok: true, productId, priceIds };
  }

  async syncTopUpPack(input: { topUpPackId: string }) {
    const { stripe, environment } = await this.runtime();
    const pack = await prisma.topUpPack.findUniqueOrThrow({
      where: { id: input.topUpPackId },
    });
    const product = await stripe.products.create({
      name: pack.name,
      metadata: { topUpPackId: pack.id },
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(Number(pack.price) * 100),
      currency: (pack.currency || "usd").toLowerCase(),
      metadata: { topUpPackId: pack.id, kind: "topup" },
    });
    await prisma.providerPriceMap.updateMany({
      where: {
        provider: "STRIPE",
        environment,
        topUpPackId: pack.id,
        interval: "ONE_TIME",
        active: true,
      },
      data: { active: false },
    });
    await prisma.providerPriceMap.create({
      data: {
        provider: "STRIPE",
        environment,
        interval: "ONE_TIME",
        topUpPackId: pack.id,
        externalProductId: product.id,
        externalPriceId: price.id,
        active: true,
      },
    });
    return { ok: true, priceId: price.id };
  }

  private async resolvePriceId(
    planVersionId: string,
    interval: "MONTHLY" | "YEARLY"
  ) {
    const { environment } = await this.runtime();
    const map = await prisma.providerPriceMap.findFirst({
      where: {
        provider: "STRIPE",
        environment,
        planVersionId,
        interval,
        active: true,
      },
    });
    if (!map) {
      const version = await prisma.planVersion.findUniqueOrThrow({
        where: { id: planVersionId },
      });
      await this.syncProductAndPrices({
        planId: version.planId,
        planVersionId,
      });
      return prisma.providerPriceMap.findFirstOrThrow({
        where: {
          provider: "STRIPE",
          environment,
          planVersionId,
          interval,
          active: true,
        },
      });
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
    if (!(await paymentConfigService.isPaymentsLive())) {
      throw new ValidationError("Payments are not enabled yet");
    }
    if (env.PLATFORM_OWNER_ORG_ID === input.organizationId) {
      throw new ValidationError("Platform owner is never billed");
    }
    const { stripe } = await this.runtime();
    const version = await prisma.planVersion.findUnique({
      where: { id: input.planVersionId },
      include: { plan: true },
    });
    if (
      !version ||
      version.status !== PlanVersionStatus.PUBLISHED ||
      version.plan.visibility !== PlanVisibility.PUBLIC
    ) {
      throw new ValidationError("Plan version is not available for checkout");
    }
    const customer = await this.createCustomer({
      organizationId: input.organizationId,
      email: input.customerEmail,
      name: (
        await prisma.organization.findUniqueOrThrow({
          where: { id: input.organizationId },
        })
      ).name,
    });
    const price = await this.resolvePriceId(
      input.planVersionId,
      input.interval
    );
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.externalCustomerId,
      line_items: [{ price: price.externalPriceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      locale: "en",
      currency: "usd",
      metadata: {
        organizationId: input.organizationId,
        planVersionId: version.id,
        planId: version.planId,
        interval: input.interval,
        kind: "subscription",
        stripeEnv: modeToEnvironment(
          (await paymentConfigService.getProviderConfig("STRIPE"))!.mode as
            | "SANDBOX"
            | "LIVE"
        ),
      },
      subscription_data: {
        metadata: {
          organizationId: input.organizationId,
          planVersionId: version.id,
          interval: input.interval,
        },
      },
    });
    return {
      mode: "redirect" as const,
      checkoutUrl: session.url || undefined,
      transactionId: session.id,
    };
  }

  async createTopUpCheckout(input: {
    organizationId: string;
    topUpPackId: string;
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    if (!(await paymentConfigService.isPaymentsLive())) {
      throw new ValidationError("Payments are not enabled yet");
    }
    const { stripe, environment } = await this.runtime();
    let map = await prisma.providerPriceMap.findFirst({
      where: {
        provider: "STRIPE",
        environment,
        topUpPackId: input.topUpPackId,
        interval: "ONE_TIME",
        active: true,
      },
    });
    if (!map) {
      await this.syncTopUpPack({ topUpPackId: input.topUpPackId });
      map = await prisma.providerPriceMap.findFirstOrThrow({
        where: {
          provider: "STRIPE",
          environment,
          topUpPackId: input.topUpPackId,
          interval: "ONE_TIME",
          active: true,
        },
      });
    }
    const pack = await prisma.topUpPack.findUniqueOrThrow({
      where: { id: input.topUpPackId },
    });
    const customer = await this.createCustomer({
      organizationId: input.organizationId,
      email: input.customerEmail,
      name: (
        await prisma.organization.findUniqueOrThrow({
          where: { id: input.organizationId },
        })
      ).name,
    });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customer.externalCustomerId,
      line_items: [{ price: map.externalPriceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      locale: "en",
      metadata: {
        organizationId: input.organizationId,
        topUpPackId: pack.id,
        kind: "topup",
        credits: String(pack.credits),
      },
    });
    return {
      mode: "redirect" as const,
      checkoutUrl: session.url || undefined,
      transactionId: session.id,
    };
  }

  async createPortalSession(input: {
    organizationId: string;
    returnUrl: string;
  }) {
    const { stripe, environment } = await this.runtime();
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
    });
    if (!org.stripeCustomerId || org.stripeCustomerEnv !== environment) {
      throw new ValidationError("No Stripe customer for this environment");
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: input.returnUrl,
    });
    return { url: session.url };
  }

  async changeSubscription(input: {
    organizationId: string;
    planVersionId: string;
    interval: "MONTHLY" | "YEARLY";
    proration: boolean;
    effective: "immediate" | "period_end";
  }) {
    const { stripe } = await this.runtime();
    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: input.organizationId },
    });
    if (!sub.externalSubscriptionId) {
      throw new ValidationError("No active Stripe subscription");
    }
    const price = await this.resolvePriceId(
      input.planVersionId,
      input.interval
    );
    const stripeSub = await stripe.subscriptions.retrieve(
      sub.externalSubscriptionId
    );
    const itemId = stripeSub.items.data[0]?.id;
    if (!itemId) throw new ValidationError("Stripe subscription has no items");
    await stripe.subscriptions.update(sub.externalSubscriptionId, {
      items: [{ id: itemId, price: price.externalPriceId }],
      proration_behavior: input.proration ? "create_prorations" : "none",
      ...(input.effective === "period_end"
        ? { billing_cycle_anchor: "unchanged" as const }
        : {}),
      metadata: {
        organizationId: input.organizationId,
        planVersionId: input.planVersionId,
        interval: input.interval,
      },
    });
    return { ok: true };
  }

  async cancelSubscription(input: {
    organizationId: string;
    atPeriodEnd: boolean;
  }) {
    const { stripe } = await this.runtime();
    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: input.organizationId },
    });
    if (!sub.externalSubscriptionId) {
      throw new ValidationError("No active Stripe subscription");
    }
    if (input.atPeriodEnd) {
      await stripe.subscriptions.update(sub.externalSubscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      await stripe.subscriptions.cancel(sub.externalSubscriptionId);
    }
    return { ok: true };
  }

  async resumeSubscription(input: { organizationId: string }) {
    const { stripe } = await this.runtime();
    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: input.organizationId },
    });
    if (!sub.externalSubscriptionId) {
      throw new ValidationError("No active Stripe subscription");
    }
    await stripe.subscriptions.update(sub.externalSubscriptionId, {
      cancel_at_period_end: false,
    });
    return { ok: true };
  }

  async verifyWebhook(input: {
    rawBody: string;
    signatureHeader: string | null;
  }) {
    const { stripe, webhookSecret } = await this.runtime();
    if (!webhookSecret || !input.signatureHeader) {
      throw new ValidationError("Stripe webhook secret missing");
    }
    const event = stripe.webhooks.constructEvent(
      input.rawBody,
      input.signatureHeader,
      webhookSecret
    );
    return {
      eventId: event.id,
      eventType: event.type,
      payload: event,
      occurredAt: new Date(event.created * 1000),
    };
  }

  async mapEvent(payload: unknown): Promise<MappedBillingEvent> {
    const event = payload as {
      type?: string;
      data?: { object?: Record<string, unknown> };
      created?: number;
    };
    const obj = event.data?.object || {};
    const meta =
      (obj.metadata as Record<string, string> | undefined) ||
      ((obj as { subscription_details?: { metadata?: Record<string, string> } })
        .subscription_details?.metadata) ||
      {};
    const organizationId =
      meta.organizationId ||
      (obj.metadata as { organizationId?: string } | undefined)?.organizationId;
    const occurredAt = event.created
      ? new Date(event.created * 1000)
      : new Date();
    const eventType = event.type || "";

    if (!organizationId) {
      return { type: "unmatched", reason: "missing organizationId in metadata" };
    }

    if (eventType === "checkout.session.completed") {
      const kind = meta.kind || "subscription";
      if (kind === "topup") {
        return {
          type: "topup_paid",
          organizationId,
          topUpPackId: meta.topUpPackId || "",
          transactionId: String(obj.id || ""),
          credits: Number(meta.credits || 0),
          occurredAt,
        };
      }
      const planVersionId = meta.planVersionId;
      if (!planVersionId) {
        return { type: "unmatched", reason: "no planVersionId" };
      }
      const periodStart = new Date();
      const periodEnd = new Date(periodStart.getTime() + 30 * 86_400_000);
      return {
        type: "subscription_activated",
        organizationId,
        planVersionId,
        interval: (meta.interval as "MONTHLY" | "YEARLY") || "MONTHLY",
        externalCustomerId: String(obj.customer || ""),
        externalSubscriptionId: String(obj.subscription || ""),
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        transactionId: String(obj.id || ""),
      };
    }

    if (
      eventType === "customer.subscription.updated" ||
      eventType === "customer.subscription.created"
    ) {
      return {
        type: "subscription_updated",
        organizationId,
        externalSubscriptionId: String(obj.id || ""),
        planVersionId: meta.planVersionId,
        interval: meta.interval as "MONTHLY" | "YEARLY" | undefined,
        status: String(obj.status || ""),
        cancelAtPeriodEnd: Boolean(obj.cancel_at_period_end),
        currentPeriodStart: obj.current_period_start
          ? new Date(Number(obj.current_period_start) * 1000)
          : undefined,
        currentPeriodEnd: obj.current_period_end
          ? new Date(Number(obj.current_period_end) * 1000)
          : undefined,
        occurredAt,
      };
    }

    if (eventType === "customer.subscription.deleted") {
      return {
        type: "subscription_canceled",
        organizationId,
        externalSubscriptionId: String(obj.id || ""),
        occurredAt,
      };
    }

    if (eventType === "invoice.paid") {
      const existing = await prisma.subscription.findUnique({
        where: { organizationId },
      });
      if (existing?.status === "ACTIVE" && obj.billing_reason === "subscription_cycle") {
        return {
          type: "renewal_paid",
          organizationId,
          externalSubscriptionId: String(obj.subscription || ""),
          transactionId: String(obj.id || ""),
          currentPeriodStart: obj.period_start
            ? new Date(Number(obj.period_start) * 1000)
            : new Date(),
          currentPeriodEnd: obj.period_end
            ? new Date(Number(obj.period_end) * 1000)
            : new Date(),
          occurredAt,
        };
      }
    }

    if (eventType === "invoice.payment_failed") {
      return {
        type: "payment_failed",
        organizationId,
        externalSubscriptionId: String(obj.subscription || ""),
        occurredAt,
      };
    }

    if (
      eventType === "charge.refunded" ||
      eventType === "charge.dispute.created"
    ) {
      return {
        type: "refund_or_chargeback",
        organizationId,
        transactionId: String(obj.id || ""),
        isChargeback: eventType === "charge.dispute.created",
        occurredAt,
      };
    }

    return { type: "unmatched", reason: `unhandled event ${eventType}` };
  }

  async testConnection() {
    try {
      const { stripe, environment } = await this.runtime();
      await stripe.balance.retrieve();
      return { ok: true, message: `Stripe ${environment} OK` };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Stripe connection failed",
      };
    }
  }
}

export const stripeProvider = new StripeProvider();
/** @deprecated alias */
export const stripeStubProvider = stripeProvider;
