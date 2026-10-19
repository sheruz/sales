import prisma from "@/lib/db/prisma";
import {
  EmailAccountStatus,
  MembershipStatus,
  OutboundMailboxStatus,
  SubscriptionStatus,
  UsageMetric,
  type PlanFeature,
} from "@prisma/client";
import { ValidationError } from "@/lib/api/response";
import {
  FEATURE_KEYS,
  type FeatureKey,
  DEFAULT_PLANS,
} from "@/lib/billing/features";

function periodStart(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Metered features tracked in usage_records per billing period */
const FEATURE_TO_METRIC: Partial<Record<FeatureKey, UsageMetric>> = {
  [FEATURE_KEYS.AI_CALLS]: UsageMetric.AI_CALLS,
  [FEATURE_KEYS.EMAILS]: UsageMetric.EMAILS,
  [FEATURE_KEYS.OPPORTUNITIES]: UsageMetric.OPPORTUNITIES,
  [FEATURE_KEYS.ENRICHMENT]: UsageMetric.ENRICHMENT,
  [FEATURE_KEYS.SOURCES]: UsageMetric.SOURCE_CALLS,
  [FEATURE_KEYS.AUTOMATION]: UsageMetric.AUTOMATION_RUNS,
};

/** Seat/inventory features enforced against live resource counts */
const SEAT_FEATURES = new Set<FeatureKey>([
  FEATURE_KEYS.USERS,
  FEATURE_KEYS.SEQUENCES,
  FEATURE_KEYS.INBOX_ACCOUNTS,
  FEATURE_KEYS.OUTBOUND_MAILBOXES,
  FEATURE_KEYS.CONNECTORS,
]);

export class EntitlementService {
  async ensureDefaultPlans() {
    const count = await prisma.plan.count();
    if (count === 0) {
      for (const plan of DEFAULT_PLANS) {
        await prisma.plan.create({
          data: {
            name: plan.name,
            description: plan.description,
            price: plan.price,
            currency: plan.currency,
            billingInterval: plan.billingInterval,
            isDefault: plan.isDefault,
            sortOrder: plan.sortOrder,
            active: true,
            features: {
              create: plan.features.map((f) => ({
                featureKey: f.featureKey,
                limitValue: f.limitValue,
                enabled: f.enabled,
              })),
            },
          },
        });
      }
      return;
    }

    // Backfill newly introduced feature keys onto catalog plans (idempotent).
    for (const plan of DEFAULT_PLANS) {
      const row = await prisma.plan.findFirst({ where: { name: plan.name } });
      if (!row) continue;
      for (const f of plan.features) {
        await prisma.planFeature.upsert({
          where: {
            planId_featureKey: {
              planId: row.id,
              featureKey: f.featureKey,
            },
          },
          create: {
            planId: row.id,
            featureKey: f.featureKey,
            limitValue: f.limitValue,
            enabled: f.enabled,
          },
          update: {},
        });
      }
    }
  }

  async getDefaultPlan() {
    await this.ensureDefaultPlans();
    return prisma.plan.findFirst({
      where: { isDefault: true, active: true },
      include: { features: true },
    });
  }

  async listPlans() {
    await this.ensureDefaultPlans();
    return prisma.plan.findMany({
      where: { active: true },
      include: { features: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  async ensureSubscription(organizationId: string) {
    const existing = await prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: { include: { features: true } } },
    });
    if (existing) return existing;

    const plan = await this.getDefaultPlan();
    if (!plan) throw new ValidationError("No default plan configured");

    return prisma.subscription.create({
      data: {
        organizationId,
        planId: plan.id,
        provider: "internal",
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: periodStart(),
        currentPeriodEnd: new Date(
          Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth() + 1,
            1
          )
        ),
      },
      include: { plan: { include: { features: true } } },
    });
  }

  async getSubscription(organizationId: string) {
    return this.ensureSubscription(organizationId);
  }

  getFeature(features: PlanFeature[], key: FeatureKey): PlanFeature | null {
    return features.find((f) => f.featureKey === key) ?? null;
  }

  async getSeatCount(organizationId: string, featureKey: FeatureKey) {
    switch (featureKey) {
      case FEATURE_KEYS.USERS:
        return prisma.organizationUser.count({
          where: {
            organizationId,
            status: MembershipStatus.ACTIVE,
          },
        });
      case FEATURE_KEYS.SEQUENCES:
        return prisma.outreachSequence.count({
          where: { organizationId },
        });
      case FEATURE_KEYS.INBOX_ACCOUNTS:
        // Only live connected inboxes — DISCONNECTED / ERROR / DISABLED / PAUSED
        // must not block reconnecting Gmail/Outlook/SMTP.
        // .env platform SMTP is never an EmailAccount row and never counts.
        return prisma.emailAccount.count({
          where: {
            organizationId,
            status: EmailAccountStatus.ACTIVE,
          },
        });
      case FEATURE_KEYS.OUTBOUND_MAILBOXES:
        return prisma.outboundMailbox.count({
          where: {
            organizationId,
            status: OutboundMailboxStatus.ACTIVE,
          },
        });
      case FEATURE_KEYS.CONNECTORS:
        return prisma.sourceConnector.count({
          where: { organizationId },
        });
      case FEATURE_KEYS.ICPS:
        return prisma.icp.count({
          where: { organizationId, status: "ACTIVE" },
        });
      case FEATURE_KEYS.CAMPAIGNS:
        return prisma.campaign.count({
          where: { organizationId, deletedAt: null },
        });
      default:
        return 0;
    }
  }

  async getUsage(organizationId: string, metric: UsageMetric) {
    const start = periodStart();
    const row = await prisma.usageRecord.findUnique({
      where: {
        organizationId_metric_periodStart: {
          organizationId,
          metric,
          periodStart: start,
        },
      },
    });
    return row?.quantity ?? 0;
  }

  async incrementUsage(
    organizationId: string,
    metric: UsageMetric,
    by = 1
  ) {
    const start = periodStart();
    return prisma.usageRecord.upsert({
      where: {
        organizationId_metric_periodStart: {
          organizationId,
          metric,
          periodStart: start,
        },
      },
      create: {
        organizationId,
        metric,
        periodStart: start,
        quantity: by,
      },
      update: { quantity: { increment: by } },
    });
  }

  async getUsageSnapshot(organizationId: string) {
    const sub = await this.ensureSubscription(organizationId);
    const start = periodStart();
    const records = await prisma.usageRecord.findMany({
      where: { organizationId, periodStart: start },
    });
    const usageMap = Object.fromEntries(
      records.map((r) => [r.metric, r.quantity])
    );

    const entitlements = await Promise.all(
      sub.plan.features.map(async (f) => {
        const key = f.featureKey as FeatureKey;
        if (SEAT_FEATURES.has(key)) {
          const used = await this.getSeatCount(organizationId, key);
          return {
            featureKey: f.featureKey,
            enabled: f.enabled,
            limit: f.limitValue,
            used,
            remaining:
              f.limitValue == null
                ? null
                : Math.max(0, f.limitValue - used),
          };
        }
        const metric = FEATURE_TO_METRIC[key];
        const used = metric ? usageMap[metric] ?? 0 : 0;
        return {
          featureKey: f.featureKey,
          enabled: f.enabled,
          limit: f.limitValue,
          used: metric ? used : null,
          remaining:
            f.limitValue == null
              ? null
              : Math.max(0, f.limitValue - (metric ? used : 0)),
        };
      })
    );

    return {
      subscription: {
        id: sub.id,
        status: sub.status,
        planId: sub.planId,
        planName: sub.plan.name,
        price: Number(sub.plan.price),
        currency: sub.plan.currency,
        billingInterval: sub.plan.billingInterval,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        provider: sub.provider,
      },
      periodStart: start,
      entitlements,
    };
  }

  /**
   * Thin wrapper → S2.5 billing gateway (metered features).
   * Prefer billingGateway.authorize directly for new code.
   */
  async assertFeature(
    organizationId: string,
    featureKey: FeatureKey,
    opts?: { increment?: boolean; amount?: number; purpose?: string; exempt?: boolean }
  ) {
    const { billingGateway } = await import(
      "@/services/billing-gateway.service"
    );
    const { FEATURE_KEYS: FK } = await import("@/lib/billing/features");
    const { BILLING_ACTIONS } = await import("@/lib/billing/actions");

    const seatAction =
      featureKey === FK.USERS
        ? BILLING_ACTIONS.SEAT_USERS
        : featureKey === FK.INBOX_ACCOUNTS
          ? BILLING_ACTIONS.SEAT_INBOX_ACCOUNTS
          : featureKey === FK.OUTBOUND_MAILBOXES
            ? BILLING_ACTIONS.SEAT_OUTBOUND_MAILBOXES
            : featureKey === FK.SEQUENCES
              ? BILLING_ACTIONS.SEAT_SEQUENCES
              : featureKey === FK.ICPS
                ? BILLING_ACTIONS.SEAT_ICPS
                : featureKey === FK.CAMPAIGNS
                  ? BILLING_ACTIONS.SEAT_CAMPAIGNS
                  : featureKey === FK.CONNECTORS
                    ? BILLING_ACTIONS.SEAT_CONNECTORS
                    : null;

    const meteredAction =
      featureKey === FK.OPPORTUNITIES
        ? BILLING_ACTIONS.OPPORTUNITY_CREATE
        : featureKey === FK.EMAILS
          ? BILLING_ACTIONS.EMAIL_SEND_AI_REPLY
          : featureKey === FK.AI_CALLS
            ? BILLING_ACTIONS.AI_CALL
            : featureKey === FK.SOURCES
              ? BILLING_ACTIONS.GOOGLE_SOURCING_PAGE
              : featureKey === FK.ENRICHMENT
                ? BILLING_ACTIONS.ENRICHMENT
                : featureKey === FK.AUDITS
                  ? BILLING_ACTIONS.AUDIT_PITCH
                  : null;

    const action = seatAction ?? meteredAction;
    if (!action) {
      // Feature flags (advanced_ai, learning, automation): gateway seat-style check
      const auth = await billingGateway.authorize({
        organizationId,
        action: BILLING_ACTIONS.AI_CALL,
        qty: opts?.amount ?? 1,
        purpose: opts?.purpose ?? featureKey,
        exempt: opts?.exempt,
      });
      if (!auth.allowed) {
        const { ForbiddenError } = await import("@/lib/api/response");
        throw new ForbiddenError(auth.message);
      }
      if (opts?.increment !== false) {
        await billingGateway.commit({
          organizationId,
          reservationId: auth.reservationId,
        });
      } else {
        await billingGateway.refund({
          organizationId,
          reservationId: auth.reservationId,
          reason: "seat_precheck",
        });
      }
      return { ok: true as const, plan: "gateway", shadow: auth };
    }

    const auth = await billingGateway.authorize({
      organizationId,
      action,
      qty: opts?.amount ?? 1,
      purpose: opts?.purpose,
      exempt: opts?.exempt,
    });
    if (!auth.allowed) {
      const { ForbiddenError } = await import("@/lib/api/response");
      throw new ForbiddenError(auth.message);
    }

    // Seats: authorize-only (live count); refund auth so it doesn't stay in-flight
    if (seatAction || opts?.increment === false) {
      await billingGateway.refund({
        organizationId,
        reservationId: auth.reservationId,
        reason: "seat_precheck",
      });
      return { ok: true as const, plan: "gateway", shadow: auth };
    }

    await billingGateway.commit({
      organizationId,
      reservationId: auth.reservationId,
    });
    return { ok: true as const, plan: "gateway", shadow: auth };
  }

  async assertAndConsume(
    organizationId: string,
    featureKey: FeatureKey,
    amount = 1,
    opts?: { purpose?: string; exempt?: boolean }
  ) {
    return this.assertFeature(organizationId, featureKey, {
      increment: true,
      amount,
      purpose: opts?.purpose,
      exempt: opts?.exempt,
    });
  }

  /** Pre-check before creating a seat-limited resource */
  async assertSeatAvailable(organizationId: string, featureKey: FeatureKey) {
    return this.assertFeature(organizationId, featureKey, {
      amount: 1,
      increment: false,
    });
  }

  async getShadowWouldBlocks(organizationId: string) {
    const { entitlementsService } = await import("@/lib/billing/entitlements");
    return entitlementsService.listShadowWouldBlocks(organizationId);
  }
}

export const entitlementService = new EntitlementService();
