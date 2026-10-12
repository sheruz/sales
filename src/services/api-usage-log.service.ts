import prisma from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { estimateTextSearchCostUsd } from "@/lib/sourcing/cost-estimate";
import { estimateHunterCostUsd } from "@/lib/enrichment/cost-estimate";
import { estimatePageSpeedCostUsd } from "@/lib/audit/cost-estimate";

export class ApiUsageLogService {
  async logGoogleTextSearch(
    organizationId: string,
    meta?: Record<string, unknown>
  ) {
    const estimatedCostUsd = estimateTextSearchCostUsd(1);
    await prisma.apiUsageLog.create({
      data: {
        organizationId,
        provider: "google_places",
        operation: "text_search",
        estimatedCostUsd,
        units: 1,
        metadata: (meta ?? {}) as Prisma.InputJsonValue,
      },
    });
    return estimatedCostUsd;
  }

  async logPageSpeed(
    organizationId: string,
    strategy: "mobile" | "desktop",
    meta?: Record<string, unknown>
  ) {
    const estimatedCostUsd = estimatePageSpeedCostUsd();
    await prisma.apiUsageLog.create({
      data: {
        organizationId,
        provider: "google_pagespeed",
        operation: `pagespeed_${strategy}`,
        estimatedCostUsd,
        units: 1,
        metadata: (meta ?? { strategy }) as Prisma.InputJsonValue,
      },
    });
    return estimatedCostUsd;
  }

  async logClaudeAudit(
    organizationId: string,
    estimatedCostUsd: number,
    meta?: Record<string, unknown>
  ) {
    await prisma.apiUsageLog.create({
      data: {
        organizationId,
        provider: "anthropic",
        operation: "website_audit_pitch",
        estimatedCostUsd,
        units: 1,
        metadata: (meta ?? {}) as Prisma.InputJsonValue,
      },
    });
    return estimatedCostUsd;
  }

  async logHunter(
    organizationId: string,
    operation: "domain_search" | "email_verifier" | "account",
    meta?: Record<string, unknown>
  ) {
    const estimatedCostUsd = estimateHunterCostUsd(operation);
    await prisma.apiUsageLog.create({
      data: {
        organizationId,
        provider: "hunter",
        operation,
        estimatedCostUsd,
        units: 1,
        metadata: (meta ?? {}) as Prisma.InputJsonValue,
      },
    });
    return estimatedCostUsd;
  }

  async providerTotals(
    organizationId: string,
    providers: string[],
    since: Date
  ) {
    const agg = await prisma.apiUsageLog.aggregate({
      where: {
        organizationId,
        provider: { in: providers },
        createdAt: { gte: since },
      },
      _sum: { estimatedCostUsd: true },
      _count: true,
    });
    return {
      usd: Number(agg._sum.estimatedCostUsd ?? 0),
      calls: agg._count,
    };
  }

  async totals(organizationId: string) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const startOfMonth = new Date(
      Date.UTC(startOfDay.getUTCFullYear(), startOfDay.getUTCMonth(), 1)
    );

    const [today, month, recent] = await Promise.all([
      prisma.apiUsageLog.aggregate({
        where: {
          organizationId,
          provider: "google_places",
          createdAt: { gte: startOfDay },
        },
        _sum: { estimatedCostUsd: true },
        _count: true,
      }),
      prisma.apiUsageLog.aggregate({
        where: {
          organizationId,
          provider: "google_places",
          createdAt: { gte: startOfMonth },
        },
        _sum: { estimatedCostUsd: true },
        _count: true,
      }),
      prisma.apiUsageLog.findMany({
        where: { organizationId, provider: "google_places" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          operation: true,
          estimatedCostUsd: true,
          createdAt: true,
          metadata: true,
        },
      }),
    ]);

    return {
      todayUsd: Number(today._sum.estimatedCostUsd ?? 0),
      todayCalls: today._count,
      monthUsd: Number(month._sum.estimatedCostUsd ?? 0),
      monthCalls: month._count,
      recent: recent.map((r) => ({
        id: r.id,
        operation: r.operation,
        estimatedCostUsd: Number(r.estimatedCostUsd),
        createdAt: r.createdAt.toISOString(),
        metadata: r.metadata,
      })),
    };
  }
}

export const apiUsageLogService = new ApiUsageLogService();
