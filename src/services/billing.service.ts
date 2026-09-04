import Stripe from "stripe";
import prisma from "@/lib/db/prisma";
import { SubscriptionStatus } from "@prisma/client";
import { env } from "@/lib/config/env";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { entitlementService } from "@/services/entitlement.service";

function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new ValidationError(
      "Stripe is not configured. Set STRIPE_SECRET_KEY to enable paid plans."
    );
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-08-26.dahlia",
  });
}

function subscriptionPeriod(subscription: Stripe.Subscription): {
  start: Date | null;
  end: Date | null;
} {
  const item = subscription.items?.data?.[0];
  const start =
    item && typeof item.current_period_start === "number"
      ? item.current_period_start
      : (subscription as { current_period_start?: number }).current_period_start;
  const end =
    item && typeof item.current_period_end === "number"
      ? item.current_period_end
      : (subscription as { current_period_end?: number }).current_period_end;
  return {
    start: start ? new Date(start * 1000) : null,
    end: end ? new Date(end * 1000) : null,
  };
}

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "past_due":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    case "incomplete":
      return SubscriptionStatus.INCOMPLETE;
    case "unpaid":
      return SubscriptionStatus.UNPAID;
    case "incomplete_expired":
      return SubscriptionStatus.INCOMPLETE_EXPIRED;
    default:
      return SubscriptionStatus.ACTIVE;
  }
}

export class BillingService {
  async createCheckoutSession(input: {
    organizationId: string;
    planId: string;
    userEmail: string;
    successUrl?: string;
    cancelUrl?: string;
  }) {
    const plan = await prisma.plan.findFirst({
      where: { id: input.planId, active: true },
    });
    if (!plan) throw new NotFoundError("Plan not found");
    if (Number(plan.price) <= 0) {
      throw new ValidationError("Use the Free plan without checkout");
    }
    if (!plan.stripePriceId) {
      throw new ValidationError(
        `Plan "${plan.name}" has no Stripe price ID. Set stripePriceId on the plan.`
      );
    }

    const stripe = getStripe();
    const sub = await entitlementService.ensureSubscription(input.organizationId);

    let customerId = sub.externalCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: input.userEmail,
        metadata: { organizationId: input.organizationId },
      });
      customerId = customer.id;
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { externalCustomerId: customerId, provider: "stripe" },
      });
    }

    const success =
      input.successUrl ??
      env.STRIPE_SUCCESS_URL ??
      `${env.APP_URL}/dashboard/settings?tab=billing&checkout=success`;
    const cancel =
      input.cancelUrl ??
      env.STRIPE_CANCEL_URL ??
      `${env.APP_URL}/dashboard/settings?tab=billing&checkout=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: success,
      cancel_url: cancel,
      client_reference_id: input.organizationId,
      metadata: {
        organizationId: input.organizationId,
        planId: plan.id,
      },
      subscription_data: {
        metadata: {
          organizationId: input.organizationId,
          planId: plan.id,
        },
      },
      allow_promotion_codes: true,
    });

    return { url: session.url, sessionId: session.id };
  }

  async createPortalSession(organizationId: string) {
    const sub = await entitlementService.ensureSubscription(organizationId);
    if (!sub.externalCustomerId) {
      throw new ValidationError("No Stripe customer on this organization yet");
    }
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.externalCustomerId,
      return_url: `${env.APP_URL}/dashboard/settings?tab=billing`,
    });
    return { url: session.url };
  }

  async switchToFreePlan(organizationId: string) {
    const free = await prisma.plan.findFirst({
      where: { isDefault: true, active: true },
    });
    if (!free) throw new ValidationError("Free plan missing");

    const sub = await entitlementService.ensureSubscription(organizationId);
    if (sub.externalSubscriptionId && isStripeConfigured()) {
      const stripe = getStripe();
      await stripe.subscriptions.update(sub.externalSubscriptionId, {
        cancel_at_period_end: true,
        metadata: {
          organizationId,
          planId: free.id,
        },
      });
    }

    return prisma.subscription.update({
      where: { organizationId },
      data: {
        planId: free.id,
        status: SubscriptionStatus.ACTIVE,
        cancelAtPeriodEnd: true,
        provider: sub.externalSubscriptionId ? "stripe" : "internal",
      },
      include: { plan: { include: { features: true } } },
    });
  }

  /**
   * Upgrade/downgrade: Stripe item swap when subscribed; otherwise Checkout.
   */
  async changePlan(input: {
    organizationId: string;
    planId: string;
    userEmail: string;
  }) {
    const plan = await prisma.plan.findFirst({
      where: { id: input.planId, active: true },
    });
    if (!plan) throw new NotFoundError("Plan not found");

    if (Number(plan.price) <= 0) {
      const updated = await this.switchToFreePlan(input.organizationId);
      return { mode: "free" as const, subscription: updated };
    }

    const sub = await entitlementService.ensureSubscription(
      input.organizationId
    );

    if (
      sub.externalSubscriptionId &&
      plan.stripePriceId &&
      isStripeConfigured()
    ) {
      const stripe = getStripe();
      const stripeSub = await stripe.subscriptions.retrieve(
        sub.externalSubscriptionId
      );
      const itemId = stripeSub.items.data[0]?.id;
      if (!itemId) {
        throw new ValidationError("Stripe subscription has no items");
      }
      await stripe.subscriptions.update(sub.externalSubscriptionId, {
        items: [{ id: itemId, price: plan.stripePriceId }],
        proration_behavior: "create_prorations",
        cancel_at_period_end: false,
        metadata: {
          organizationId: input.organizationId,
          planId: plan.id,
        },
      });
      const updated = await prisma.subscription.update({
        where: { organizationId: input.organizationId },
        data: {
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          cancelAtPeriodEnd: false,
          provider: "stripe",
        },
        include: { plan: { include: { features: true } } },
      });
      return { mode: "updated" as const, subscription: updated };
    }

    const checkout = await this.createCheckoutSession({
      organizationId: input.organizationId,
      planId: plan.id,
      userEmail: input.userEmail,
    });
    return { mode: "checkout" as const, ...checkout };
  }

  /**
   * Idempotent webhook processor — claim event.id before side effects.
   */
  async handleStripeWebhook(rawBody: string, signature: string) {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new ValidationError("STRIPE_WEBHOOK_SECRET is not set");
    }
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );

    try {
      await prisma.billingWebhookEvent.create({
        data: {
          provider: "stripe",
          eventId: event.id,
          eventType: event.type,
          payload: event as unknown as object,
          status: "processing",
        },
      });
    } catch {
      const existing = await prisma.billingWebhookEvent.findUnique({
        where: { eventId: event.id },
      });
      if (existing) {
        return { ok: true, duplicate: true, eventId: event.id };
      }
      throw new ValidationError("Failed to claim webhook event");
    }

    try {
      await this.applyStripeEvent(event);
      await prisma.billingWebhookEvent.update({
        where: { eventId: event.id },
        data: { status: "processed" },
      });
      return { ok: true, duplicate: false, eventId: event.id };
    } catch (error) {
      await prisma.billingWebhookEvent.update({
        where: { eventId: event.id },
        data: {
          status: "error",
          error: error instanceof Error ? error.message : "webhook_failed",
        },
      });
      throw error;
    }
  }

  private async applyStripeEvent(event: Stripe.Event) {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId =
          session.metadata?.organizationId ||
          session.client_reference_id ||
          undefined;
        const planId = session.metadata?.planId;
        if (!organizationId) return;
        await this.upsertFromStripeSubscriptionIds({
          organizationId,
          planId,
          customerId:
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id,
          subscriptionId:
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id,
          status: SubscriptionStatus.ACTIVE,
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata?.organizationId;
        const planId = subscription.metadata?.planId;
        if (!organizationId) {
          // Fallback: find by customer id
          const byCustomer = await prisma.subscription.findFirst({
            where: {
              externalCustomerId:
                typeof subscription.customer === "string"
                  ? subscription.customer
                  : subscription.customer.id,
            },
          });
          if (!byCustomer) return;
          await this.applySubscriptionObject(byCustomer.organizationId, subscription, planId);
          return;
        }
        await this.applySubscriptionObject(organizationId, subscription, planId);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        if (!customerId) return;
        await prisma.subscription.updateMany({
          where: { externalCustomerId: customerId },
          data: { status: SubscriptionStatus.ACTIVE },
        });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        if (!customerId) return;
        await prisma.subscription.updateMany({
          where: { externalCustomerId: customerId },
          data: { status: SubscriptionStatus.PAST_DUE },
        });
        break;
      }
      default:
        break;
    }
  }

  private async applySubscriptionObject(
    organizationId: string,
    subscription: Stripe.Subscription,
    planId?: string
  ) {
    const status =
      subscription.status === "canceled" && !subscription.cancel_at_period_end
        ? SubscriptionStatus.CANCELED
        : mapStripeStatus(subscription.status);

    let resolvedPlanId = planId;
    if (!resolvedPlanId) {
      const priceId = subscription.items.data[0]?.price?.id;
      if (priceId) {
        const plan = await prisma.plan.findFirst({
          where: { stripePriceId: priceId },
        });
        resolvedPlanId = plan?.id;
      }
    }

    const period = subscriptionPeriod(subscription);
    await this.upsertFromStripeSubscriptionIds({
      organizationId,
      planId: resolvedPlanId,
      customerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      subscriptionId: subscription.id,
      status,
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
    });
  }

  private async upsertFromStripeSubscriptionIds(input: {
    organizationId: string;
    planId?: string | null;
    customerId?: string | null;
    subscriptionId?: string | null;
    status: SubscriptionStatus;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
    canceledAt?: Date | null;
  }) {
    await entitlementService.ensureSubscription(input.organizationId);
    const data: {
      provider: string;
      status: SubscriptionStatus;
      externalCustomerId?: string;
      externalSubscriptionId?: string;
      planId?: string;
      currentPeriodStart?: Date | null;
      currentPeriodEnd?: Date | null;
      cancelAtPeriodEnd?: boolean;
      canceledAt?: Date | null;
    } = {
      provider: "stripe",
      status: input.status,
      externalCustomerId: input.customerId ?? undefined,
      externalSubscriptionId: input.subscriptionId ?? undefined,
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      canceledAt: input.canceledAt,
    };
    if (input.planId) data.planId = input.planId;

    await prisma.subscription.update({
      where: { organizationId: input.organizationId },
      data,
    });
  }
}

export const billingService = new BillingService();
