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
   * Server-side entitlement gate. Delegates to S1 entitlementsService
   * (metering + shadow would-blocks; enforcement behind flag).
   */
  async assertFeature(
    organizationId: string,
    featureKey: FeatureKey,
    opts?: { increment?: boolean; amount?: number; purpose?: string; exempt?: boolean }
  ) {
    const { entitlementsService } = await import("@/lib/billing/entitlements");
    const result = await entitlementsService.consume(
      organizationId,
      featureKey,
      opts?.amount ?? 1,
      {
        purpose: opts?.purpose,
        exempt: opts?.exempt,
        increment: opts?.increment === true,
      }
    );
    return { ok: true as const, plan: result.planName ?? "unknown", shadow: result };
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
