import prisma from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

/**
 * Best-effort audit trail. Never throws to callers.
 */
export async function writeAuditLog(input: {
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}) {
  try {
    if (!input.organizationId && !input.userId) {
      logger.info("audit", { action: input.action, ...input.newValues });
      return;
    }
    // AuditLog requires organizationId in schema — check
    if (!input.organizationId) {
      logger.info("audit_no_org", {
        action: input.action,
        userId: input.userId,
      });
      return;
    }
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? undefined,
        action: input.action,
        entityType: input.entityType ?? "system",
        entityId: input.entityId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        oldValues: input.oldValues as Prisma.InputJsonValue | undefined,
        newValues: input.newValues as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    logger.warn("audit_write_failed", {
      action: input.action,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}
