/**
 * B2: per-tenant entitlement overrides with optional expiry.
 */

import prisma from "@/lib/db/prisma";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { isKnownFeatureKey } from "@/lib/billing/features";
import { organizationService } from "@/services/organization.service";
import { planPauseService } from "@/services/plan-pause.service";
import { billingGateway } from "@/services/billing-gateway.service";

export class OverrideAdminService {
  async list(organizationId: string) {
    const rows = await prisma.orgEntitlementOverride.findMany({
      where: { organizationId },
      orderBy: { key: "asc" },
    });
    const effective = [];
    for (const row of rows) {
      const feat = await billingGateway.getEffectiveFeature(
        organizationId,
        row.key as never
      );
      effective.push({
        ...row,
        effective: feat,
      });
    }
    return effective;
  }

  async upsert(input: {
    organizationId: string;
    key: string;
    limitValue?: number | null;
    enabled?: boolean | null;
    reason: string;
    expiresAt?: Date | null;
    actorUserId: string;
  }) {
    if (!input.reason?.trim()) throw new ValidationError("reason is required");
    if (!isKnownFeatureKey(input.key) && !input.key.startsWith("credits:")) {
      // allow known features + credit-ish keys
      if (!isKnownFeatureKey(input.key)) {
        throw new ValidationError(`Unknown key: ${input.key}`);
      }
    }

    const before = await prisma.orgEntitlementOverride.findUnique({
      where: {
        organizationId_key: {
          organizationId: input.organizationId,
          key: input.key,
        },
      },
    });

    const row = await prisma.orgEntitlementOverride.upsert({
      where: {
        organizationId_key: {
          organizationId: input.organizationId,
          key: input.key,
        },
      },
      create: {
        organizationId: input.organizationId,
        key: input.key,
        limitValue: input.limitValue ?? null,
        enabled: input.enabled ?? null,
        reason: input.reason,
        setByUserId: input.actorUserId,
        expiresAt: input.expiresAt ?? null,
      },
      update: {
        limitValue: input.limitValue ?? null,
        enabled: input.enabled ?? null,
        reason: input.reason,
        setByUserId: input.actorUserId,
        expiresAt: input.expiresAt ?? null,
      },
    });

    await organizationService.writePlatformAudit({
      actorUserId: input.actorUserId,
      action: "override.upsert",
      targetType: "org_entitlement_override",
      targetId: row.id,
      organizationId: input.organizationId,
      before,
      after: row,
      reason: input.reason,
    });

    return row;
  }

  async remove(input: {
    organizationId: string;
    key: string;
    reason: string;
    actorUserId: string;
  }) {
    if (!input.reason?.trim()) throw new ValidationError("reason is required");
    const before = await prisma.orgEntitlementOverride.findUnique({
      where: {
        organizationId_key: {
          organizationId: input.organizationId,
          key: input.key,
        },
      },
    });
    if (!before) throw new NotFoundError("Override not found");
    await prisma.orgEntitlementOverride.delete({
      where: { id: before.id },
    });
    await organizationService.writePlatformAudit({
      actorUserId: input.actorUserId,
      action: "override.removed",
      targetType: "org_entitlement_override",
      targetId: before.id,
      organizationId: input.organizationId,
      before,
      reason: input.reason,
    });

    // Re-check limits after removing a raising override
    await this.reapplyLimitsAfterOverrideChange(input.organizationId, input.actorUserId);
    return { ok: true };
  }

  async expireDue(now = new Date()): Promise<number> {
    const expired = await prisma.orgEntitlementOverride.findMany({
      where: { expiresAt: { lte: now } },
    });
    let n = 0;
    for (const row of expired) {
      await prisma.orgEntitlementOverride.delete({ where: { id: row.id } });
      await organizationService.writePlatformAudit({
        action: "override.expired",
        targetType: "org_entitlement_override",
        targetId: row.id,
        organizationId: row.organizationId,
        before: row,
      });
      await this.reapplyLimitsAfterOverrideChange(row.organizationId, null);
      n++;
    }
    return n;
  }

  async reapplyLimitsAfterOverrideChange(
    organizationId: string,
    actorUserId: string | null
  ) {
    const seatKeys = [
      "users",
      "outbound_mailboxes",
      "campaigns",
      "sequences",
      "icps",
      "connectors",
    ];
    const limits: Record<string, number | null> = {};
    for (const key of seatKeys) {
      const feat = await billingGateway.getEffectiveFeature(
        organizationId,
        key as never
      );
      limits[key] = feat?.limitValue ?? null;
    }
    await planPauseService.reconcileOrgLimits(
      organizationId,
      limits,
      null,
      actorUserId
    );
  }
}

export const overrideAdminService = new OverrideAdminService();
