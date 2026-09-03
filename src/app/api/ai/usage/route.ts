import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    const user = await requirePermission("integrations:manage");

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const logs = await prisma.aIUsageLog.findMany({
      where: { userId: user.id, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const byFeature: Record<string, { calls: number; tokens: number }> = {};
    let totalTokens = 0;

    for (const log of logs) {
      const key = log.feature ?? "unknown";
      if (!byFeature[key]) byFeature[key] = { calls: 0, tokens: 0 };
      byFeature[key].calls++;
      byFeature[key].tokens += log.totalTokens ?? 0;
      totalTokens += log.totalTokens ?? 0;
    }

    return NextResponse.json(
      apiSuccess({
        periodDays: 30,
        totalCalls: logs.length,
        totalTokens,
        byFeature: Object.entries(byFeature).map(([feature, stats]) => ({
          feature,
          ...stats,
        })),
        recent: logs.slice(0, 20).map((l) => ({
          feature: l.feature,
          operation: l.operation,
          provider: l.provider,
          model: l.model,
          tokens: l.totalTokens,
          cost: l.cost,
          requestId: l.requestId,
          status: l.status,
          createdAt: l.createdAt,
        })),
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
