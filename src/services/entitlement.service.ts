import prisma from "@/lib/db/prisma";
import {
  MembershipStatus,
  SubscriptionStatus,
  UsageMetric,
  type PlanFeature,
} from "@prisma/client";
import { ForbiddenError, ValidationError } from "@/lib/api/response";
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
  FEATURE_KEYS.CONNECTORS,
]);

export class EntitlementService {
  async ensureDefaultPlans() {
    const count = await prisma.plan.count();
    if (count > 0) return;

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
        return prisma.emailAccount.count({
          where: { organizationId },
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
   * Server-side entitlement gate. Never trust the frontend.
   * Boolean features: enabled must be true.
   * Limited features: usage/seats < limit (null limit = unlimited when enabled).
   */
  async assertFeature(
    organizationId: string,
    featureKey: FeatureKey,
    opts?: { increment?: boolean; amount?: number }
  ) {
    const sub = await this.ensureSubscription(organizationId);
    if (
      sub.status === SubscriptionStatus.CANCELED ||
      sub.status === SubscriptionStatus.UNPAID ||
      sub.status === SubscriptionStatus.INCOMPLETE_EXPIRED
    ) {
      throw new ForbiddenError(
        "Subscription is inactive. Please update billing to continue."
      );
    }

    const feature = this.getFeature(sub.plan.features, featureKey);
    if (!feature || !feature.enabled) {
      throw new ForbiddenError(
        `Feature "${featureKey}" is not included in the ${sub.plan.name} plan. Upgrade to continue.`
      );
    }

    const amount = opts?.amount ?? 1;

    if (SEAT_FEATURES.has(featureKey) && feature.limitValue != null) {
      const used = await this.getSeatCount(organizationId, featureKey);
      if (used + amount > feature.limitValue) {
        throw new ForbiddenError(
          `Plan limit reached for ${featureKey} (${used}/${feature.limitValue}). Upgrade to continue.`
        );
      }
      return { ok: true as const, plan: sub.plan.name };
    }

    const metric = FEATURE_TO_METRIC[featureKey];
    if (metric && feature.limitValue != null) {
      const used = await this.getUsage(organizationId, metric);
      if (opts?.increment) {
        if (used + amount > feature.limitValue) {
          throw new ForbiddenError(
            `Plan limit reached for ${featureKey} (${used}/${feature.limitValue} this period). Upgrade to continue.`
          );
        }
        await this.incrementUsage(organizationId, metric, amount);
      } else if (used >= feature.limitValue) {
        throw new ForbiddenError(
          `Plan limit reached for ${featureKey} (${used}/${feature.limitValue} this period). Upgrade to continue.`
        );
      }
    }

    return { ok: true as const, plan: sub.plan.name };
  }

  async assertAndConsume(
    organizationId: string,
    featureKey: FeatureKey,
    amount = 1
  ) {
    return this.assertFeature(organizationId, featureKey, {
      increment: true,
      amount,
    });
  }

  /** Pre-check before creating a seat-limited resource */
  async assertSeatAvailable(organizationId: string, featureKey: FeatureKey) {
    return this.assertFeature(organizationId, featureKey, { amount: 1 });
  }
}

export const entitlementService = new EntitlementService();
