import { randomUUID } from "crypto";
import {
  MembershipStatus,
  SubscriptionStatus,
  UsageMetric,
  type PlanFeature,
} from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { ForbiddenError } from "@/lib/api/response";
import {
  FEATURE_KEYS,
  type FeatureKey,
} from "@/lib/billing/features";
import { entitlementService } from "@/services/entitlement.service";

/** AI / jobs that must never be blocked (inbound path). Metered for stats only. */
export const INBOUND_EXEMPT_PURPOSES = new Set([
  "inbox_reply_classification",
  "bounce_detection",
  "unsub_detection",
  "suppression",
  "reply_classification",
]);

const FEATURE_TO_METRIC: Partial<Record<FeatureKey, UsageMetric>> = {
  [FEATURE_KEYS.AI_CALLS]: UsageMetric.AI_CALLS,
  [FEATURE_KEYS.EMAILS]: UsageMetric.EMAILS,
  [FEATURE_KEYS.OPPORTUNITIES]: UsageMetric.OPPORTUNITIES,
  [FEATURE_KEYS.ENRICHMENT]: UsageMetric.ENRICHMENT,
  [FEATURE_KEYS.SOURCES]: UsageMetric.SOURCE_CALLS,
  [FEATURE_KEYS.AUTOMATION]: UsageMetric.AUTOMATION_RUNS,
};

const SEAT_FEATURES = new Set<FeatureKey>([
  FEATURE_KEYS.USERS,
  FEATURE_KEYS.SEQUENCES,
  FEATURE_KEYS.INBOX_ACCOUNTS,
  FEATURE_KEYS.OUTBOUND_MAILBOXES,
  FEATURE_KEYS.CONNECTORS,
]);

function periodStart(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export type EntitlementCheckResult = {
  allowed: boolean;
  wouldBlock: boolean;
  reason?: string;
  planName?: string;
  limit?: number | null;
  used?: number;
  shadow: boolean;
  exempt: boolean;
};

function getFeature(features: PlanFeature[], key: FeatureKey) {
  return features.find((f) => f.featureKey === key) ?? null;
}

/**
 * Single entitlements entrypoint (S1).
 * Metering ON / enforcement OFF by default → shadow would-blocks in UsageEvent.
 */
export class EntitlementsService {
  async check(
    organizationId: string,
    featureKey: FeatureKey,
    qty = 1,
    opts?: { purpose?: string; exempt?: boolean }
  ): Promise<EntitlementCheckResult> {
    const exempt =
      Boolean(opts?.exempt) ||
      (opts?.purpose ? INBOUND_EXEMPT_PURPOSES.has(opts.purpose) : false);

    const sub = await entitlementService.ensureSubscription(organizationId);
    const planName = sub.plan.name;
    const isOwner =
      sub.plan.code === "OWNER" ||
      planName === "OWNER" ||
      planName === "Internal Owner";

    if (exempt || isOwner) {
      return {
        allowed: true,
        wouldBlock: false,
        planName,
        shadow: !env.BILLING_ENFORCEMENT_ENABLED,
        exempt: exempt || isOwner,
      };
    }

    if (
      sub.status === SubscriptionStatus.CANCELED ||
      sub.status === SubscriptionStatus.UNPAID ||
      sub.status === SubscriptionStatus.INCOMPLETE_EXPIRED ||
      sub.status === SubscriptionStatus.SUSPENDED
    ) {
      return {
        allowed: false,
        wouldBlock: true,
        reason: "Subscription is inactive. Please update billing to continue.",
        planName,
        shadow: !env.BILLING_ENFORCEMENT_ENABLED,
        exempt: false,
      };
    }

    const feature = getFeature(sub.plan.features, featureKey);
    if (!feature || !feature.enabled) {
      return {
        allowed: false,
        wouldBlock: true,
        reason: `Feature "${featureKey}" is not included in the ${planName} plan. Upgrade to continue.`,
        planName,
        shadow: !env.BILLING_ENFORCEMENT_ENABLED,
        exempt: false,
      };
    }

    if (SEAT_FEATURES.has(featureKey) && feature.limitValue != null) {
      const used = await entitlementService.getSeatCount(
        organizationId,
        featureKey
      );
      if (used + qty > feature.limitValue) {
        return {
          allowed: false,
          wouldBlock: true,
          reason: `Plan limit reached for ${featureKey} (${used}/${feature.limitValue}). Upgrade to continue.`,
          planName,
          limit: feature.limitValue,
          used,
          shadow: !env.BILLING_ENFORCEMENT_ENABLED,
          exempt: false,
        };
      }
      return {
        allowed: true,
        wouldBlock: false,
        planName,
        limit: feature.limitValue,
        used,
        shadow: !env.BILLING_ENFORCEMENT_ENABLED,
        exempt: false,
      };
    }

    const metric = FEATURE_TO_METRIC[featureKey];
    if (metric && feature.limitValue != null) {
      const used = await entitlementService.getUsage(organizationId, metric);
      if (used + qty > feature.limitValue) {
        return {
          allowed: false,
          wouldBlock: true,
          reason: `Plan limit reached for ${featureKey} (${used}/${feature.limitValue} this period). Upgrade to continue.`,
          planName,
          limit: feature.limitValue,
          used,
          shadow: !env.BILLING_ENFORCEMENT_ENABLED,
          exempt: false,
        };
      }
      return {
        allowed: true,
        wouldBlock: false,
        planName,
        limit: feature.limitValue,
        used,
        shadow: !env.BILLING_ENFORCEMENT_ENABLED,
        exempt: false,
      };
    }

    return {
      allowed: true,
      wouldBlock: false,
      planName,
      shadow: !env.BILLING_ENFORCEMENT_ENABLED,
      exempt: false,
    };
  }

  async consume(
    organizationId: string,
    featureKey: FeatureKey,
    qty = 1,
    opts?: {
      purpose?: string;
      exempt?: boolean;
      idempotencyKey?: string;
      increment?: boolean;
    }
  ): Promise<EntitlementCheckResult> {
    const result = await this.check(organizationId, featureKey, qty, opts);
    const metering = env.BILLING_METERING_ENABLED !== false;
    const enforce = env.BILLING_ENFORCEMENT_ENABLED === true;

    if (metering) {
      await this.recordUsageEvent(organizationId, featureKey, qty, {
        purpose: opts?.purpose,
        wouldBlock: result.wouldBlock,
        reason: result.reason,
        exempt: result.exempt,
        idempotencyKey: opts?.idempotencyKey,
      });
    }

    if (result.wouldBlock && !result.exempt) {
      if (enforce) {
        throw new ForbiddenError(result.reason ?? "Plan limit reached");
      }
      // Shadow: allow through
      console.warn("[billing:shadow] would block", {
        organizationId,
        featureKey,
        reason: result.reason,
      });
    }

    // Increment UsageRecord when the action proceeds (including shadow allow-through).
    const metric = FEATURE_TO_METRIC[featureKey];
    const proceeds =
      result.exempt || result.allowed || (result.wouldBlock && !enforce);
    if (
      opts?.increment === true &&
      metric &&
      !SEAT_FEATURES.has(featureKey) &&
      proceeds
    ) {
      await entitlementService.incrementUsage(organizationId, metric, qty);
    }

    return {
      ...result,
      allowed: result.exempt || result.allowed || !enforce,
    };
  }

  private async recordUsageEvent(
    organizationId: string,
    featureKey: string,
    quantity: number,
    meta: {
      purpose?: string;
      wouldBlock: boolean;
      reason?: string;
      exempt?: boolean;
      idempotencyKey?: string;
    }
  ) {
    try {
      await prisma.usageEvent.create({
        data: {
          id: randomUUID(),
          organizationId,
          metric: featureKey,
          quantity,
          periodStart: periodStart(),
          idempotencyKey: meta.idempotencyKey ?? null,
          metadata: {
            purpose: meta.purpose ?? null,
            shadowWouldBlock: meta.wouldBlock && !meta.exempt,
            reason: meta.reason ?? null,
            exempt: Boolean(meta.exempt),
            enforcementEnabled: env.BILLING_ENFORCEMENT_ENABLED === true,
          },
        },
      });
    } catch (e) {
      // Unique idempotency collisions are fine
      const msg = e instanceof Error ? e.message : "";
      if (!msg.includes("Unique constraint")) {
        console.warn("[billing] usage event write failed", msg);
      }
    }
  }

  async listShadowWouldBlocks(organizationId: string, limit = 50) {
    const rows = await prisma.usageEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows
      .filter((r) => {
        const m = r.metadata as { shadowWouldBlock?: boolean } | null;
        return Boolean(m?.shadowWouldBlock);
      })
      .slice(0, limit)
      .map((r) => {
        const m = (r.metadata ?? {}) as {
          reason?: string;
          purpose?: string;
        };
        return {
          id: r.id,
          metric: r.metric,
          quantity: r.quantity,
          createdAt: r.createdAt,
          reason: m.reason ?? null,
          purpose: m.purpose ?? null,
        };
      });
  }
}

export const entitlementsService = new EntitlementsService();

// Re-export seat helper used elsewhere
export async function countActiveMembers(organizationId: string) {
  return prisma.organizationUser.count({
    where: { organizationId, status: MembershipStatus.ACTIVE },
  });
}
