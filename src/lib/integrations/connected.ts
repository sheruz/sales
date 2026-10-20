/**
 * B4a: Single definition of "connected" integration for platform metrics.
 * TenantIntegration.status === CONNECTED (never UserIntegration.isConnected).
 */

import prisma from "@/lib/db/prisma";
import { TenantIntegrationStatus } from "@prisma/client";
import { env } from "@/lib/config/env";

export async function countConnectedIntegrations(opts?: {
  organizationId?: string;
  excludeOwnerOrg?: boolean;
}): Promise<number> {
  const where: {
    status: TenantIntegrationStatus;
    organizationId?: string | { not: string };
  } = {
    status: TenantIntegrationStatus.CONNECTED,
  };
  if (opts?.organizationId) {
    where.organizationId = opts.organizationId;
  } else if (opts?.excludeOwnerOrg !== false && env.PLATFORM_OWNER_ORG_ID) {
    where.organizationId = { not: env.PLATFORM_OWNER_ORG_ID };
  }
  return prisma.tenantIntegration.count({ where });
}

export async function countConnectedByProvider(opts?: {
  excludeOwnerOrg?: boolean;
}): Promise<Record<string, number>> {
  const where: {
    status: TenantIntegrationStatus;
    organizationId?: { not: string };
  } = { status: TenantIntegrationStatus.CONNECTED };
  if (opts?.excludeOwnerOrg !== false && env.PLATFORM_OWNER_ORG_ID) {
    where.organizationId = { not: env.PLATFORM_OWNER_ORG_ID };
  }
  const rows = await prisma.tenantIntegration.groupBy({
    by: ["providerId"],
    where,
    _count: { id: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) {
    out[r.providerId] = r._count.id;
  }
  return out;
}
