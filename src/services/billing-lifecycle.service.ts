/**
 * B1 daily lifecycle transitions — idempotent, skips PLATFORM_OWNER_ORG_ID.
 */

import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { SubscriptionStatus } from "@prisma/client";
import { logger } from "@/lib/logger";
import { organizationService } from "@/services/organization.service";

export class BillingLifecycleService {
  async runDaily(): Promise<{
    trialExpired: number;
    graceSuspended: number;
    cancelReadOnly: number;
    pendingVersionsApplied: number;
  }> {
    const now = new Date();
    const ownerId = env.PLATFORM_OWNER_ORG_ID;
    let trialExpired = 0;
    let graceSuspended = 0;
    let cancelReadOnly = 0;
    let pendingVersionsApplied = 0;

    const subs = await prisma.subscription.findMany({
      where: ownerId
        ? { organizationId: { not: ownerId } }
        : undefined,
    });

    for (const sub of subs) {
      try {
        // TRIALING → EXPIRED
        if (
          sub.status === SubscriptionStatus.TRIALING &&
          sub.trialEndsAt &&
          sub.trialEndsAt < now
        ) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: SubscriptionStatus.EXPIRED },
          });
          await organizationService.writePlatformAudit({
            action: "lifecycle.trial_expired",
            targetType: "subscription",
            targetId: sub.id,
            organizationId: sub.organizationId,
            before: { status: "TRIALING" },
            after: { status: "EXPIRED" },
          });
          trialExpired++;
          continue;
        }

        // PAST_DUE → SUSPENDED after grace
        if (
          sub.status === SubscriptionStatus.PAST_DUE &&
          sub.gracePeriodEndsAt &&
          sub.gracePeriodEndsAt < now
        ) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: SubscriptionStatus.SUSPENDED },
          });
          await organizationService.writePlatformAudit({
            action: "lifecycle.grace_expired",
            targetType: "subscription",
            targetId: sub.id,
            organizationId: sub.organizationId,
            before: { status: "PAST_DUE" },
            after: { status: "SUSPENDED" },
          });
          graceSuspended++;
          continue;
        }

        // CANCELED at period end → set readOnlyUntil (30 days)
        if (
          sub.status === SubscriptionStatus.CANCELED &&
          sub.currentPeriodEnd &&
          sub.currentPeriodEnd < now &&
          !sub.readOnlyUntil
        ) {
          const readOnlyUntil = new Date(
            now.getTime() + 30 * 86_400_000
          );
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { readOnlyUntil },
          });
          await organizationService.writePlatformAudit({
            action: "lifecycle.cancel_period_ended",
            targetType: "subscription",
            targetId: sub.id,
            organizationId: sub.organizationId,
            after: { readOnlyUntil: readOnlyUntil.toISOString() },
          });
          cancelReadOnly++;
        }

        // Apply pending plan version at renewal
        if (
          sub.pendingPlanVersionId &&
          sub.pendingApplyAt &&
          sub.pendingApplyAt <= now
        ) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              planVersionId: sub.pendingPlanVersionId,
              pendingPlanVersionId: null,
              pendingApplyAt: null,
            },
          });
          await organizationService.writePlatformAudit({
            action: "lifecycle.pending_version_applied",
            targetType: "subscription",
            targetId: sub.id,
            organizationId: sub.organizationId,
            after: { planVersionId: sub.pendingPlanVersionId },
          });
          pendingVersionsApplied++;
        }
      } catch (err) {
        logger.error("billing lifecycle row failed", {
          subscriptionId: sub.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      trialExpired,
      graceSuspended,
      cancelReadOnly,
      pendingVersionsApplied,
    };
  }
}

export const billingLifecycleService = new BillingLifecycleService();
