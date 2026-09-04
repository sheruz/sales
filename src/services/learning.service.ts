import prisma from "@/lib/db/prisma";
import {
  LearningEventType,
  type Prisma,
} from "@prisma/client";
import { entitlementService } from "@/services/entitlement.service";
import { FEATURE_KEYS } from "@/lib/billing/features";

export class LearningService {
  async record(input: {
    organizationId: string;
    opportunityId?: string | null;
    eventType: LearningEventType;
    inputContext?: Record<string, unknown> | null;
    action?: string | null;
    result?: string | null;
    revenue?: number | null;
    metadata?: Record<string, unknown> | null;
  }) {
    try {
      return await prisma.learningEvent.create({
        data: {
          organizationId: input.organizationId,
          opportunityId: input.opportunityId ?? null,
          eventType: input.eventType,
          inputContext: (input.inputContext ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          action: input.action,
          result: input.result,
          revenue: input.revenue ?? undefined,
          metadata: (input.metadata ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
        },
      });
    } catch {
      // Non-blocking — learning must never break CRM writes
      return null;
    }
  }

  async list(organizationId: string, take = 100) {
    return prisma.learningEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        opportunity: {
          select: {
            id: true,
            stage: true,
            company: { select: { name: true } },
          },
        },
      },
    });
  }

  /**
   * Analyze learning dimensions and return explainable patterns.
   * Guardrail: recommendations only — never auto-applies strategy changes.
   */
  async discoverPatterns(organizationId: string) {
    await entitlementService.assertFeature(
      organizationId,
      FEATURE_KEYS.LEARNING
    );

    const events = await prisma.learningEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });

    const won = events.filter((e) => e.eventType === LearningEventType.WON);
    const lost = events.filter((e) => e.eventType === LearningEventType.LOST);
    const totalClosed = won.length + lost.length;

    type DimStat = { key: string; wins: number; losses: number; revenue: number };
    const dims = {
      industry: new Map<string, DimStat>(),
      signal: new Map<string, DimStat>(),
      title: new Map<string, DimStat>(),
      service: new Map<string, DimStat>(),
      offer: new Map<string, DimStat>(),
      channel: new Map<string, DimStat>(),
      country: new Map<string, DimStat>(),
      companySize: new Map<string, DimStat>(),
    };

    const bump = (
      map: Map<string, DimStat>,
      key: string | null | undefined,
      kind: "win" | "loss",
      revenue: number
    ) => {
      if (!key) return;
      const row = map.get(key) ?? { key, wins: 0, losses: 0, revenue: 0 };
      if (kind === "win") {
        row.wins += 1;
        row.revenue += revenue;
      } else row.losses += 1;
      map.set(key, row);
    };

    for (const e of [...won, ...lost]) {
      const ctx = (e.inputContext ?? {}) as Record<string, unknown>;
      const kind = e.eventType === LearningEventType.WON ? "win" : "loss";
      const rev = e.revenue ? Number(e.revenue) : 0;
      bump(dims.industry, String(ctx.industry || ""), kind, rev);
      bump(dims.signal, String(ctx.signalType || ""), kind, rev);
      bump(dims.title, String(ctx.contactTitle || ""), kind, rev);
      bump(dims.service, String(ctx.serviceName || ctx.serviceId || ""), kind, rev);
      bump(dims.offer, String(ctx.offerName || ctx.offerId || ""), kind, rev);
      bump(dims.channel, String(ctx.channel || ""), kind, rev);
      bump(dims.country, String(ctx.country || ""), kind, rev);
      bump(
        dims.companySize,
        String(ctx.companySize || ctx.employeeCount || ""),
        kind,
        rev
      );
    }

    const baseline =
      totalClosed > 0 ? won.length / totalClosed : 0;

    const insights: Array<{
      dimension: string;
      pattern: string;
      confidence: number;
      sampleSize: number;
      winRate: number;
      baselineWinRate: number;
      lift: number;
      recommendation: string;
      requiresApproval: true;
    }> = [];

    const evaluate = (dimension: string, map: Map<string, DimStat>) => {
      for (const row of map.values()) {
        if (!row.key || row.key === "undefined" || row.key === "") continue;
        const n = row.wins + row.losses;
        if (n < 3) continue;
        const rate = row.wins / n;
        const lift = baseline > 0 ? rate / baseline : rate > 0 ? 2 : 0;
        if (lift < 1.2 && rate < 0.5) continue;
        const confidence = Math.min(
          95,
          Math.round(40 + n * 5 + (lift - 1) * 30)
        );
        insights.push({
          dimension,
          pattern: `${dimension} "${row.key}" converted ${lift.toFixed(1)}x vs org baseline (${Math.round(rate * 100)}% win rate on ${n} closed deals).`,
          confidence,
          sampleSize: n,
          winRate: Math.round(rate * 1000) / 10,
          baselineWinRate: Math.round(baseline * 1000) / 10,
          lift: Math.round(lift * 100) / 100,
          recommendation: `Prioritize opportunities where ${dimension} matches "${row.key}". Do not auto-change ICP — review and approve.`,
          requiresApproval: true,
        });
      }
    };

    evaluate("industry", dims.industry);
    evaluate("signal", dims.signal);
    evaluate("job title", dims.title);
    evaluate("service", dims.service);
    evaluate("offer", dims.offer);
    evaluate("channel", dims.channel);
    evaluate("country", dims.country);
    evaluate("company size", dims.companySize);

    insights.sort((a, b) => b.lift - a.lift || b.confidence - a.confidence);

    return {
      baselineWinRate: Math.round(baseline * 1000) / 10,
      closedDeals: totalClosed,
      wins: won.length,
      losses: lost.length,
      eventCount: events.length,
      insights: insights.slice(0, 20),
      guardrail:
        "Learning recommends and explains with confidence. Production strategy changes require human approval.",
    };
  }

  /** Build context snapshot for an opportunity (for learning event payloads). */
  async snapshotOpportunity(organizationId: string, opportunityId: string) {
    const opp = await prisma.opportunity.findFirst({
      where: { id: opportunityId, organizationId },
      include: {
        company: true,
        primaryContact: true,
        primarySignal: true,
        recommendedService: { select: { id: true, name: true } },
        recommendedOffer: { select: { id: true, name: true } },
      },
    });
    if (!opp) return null;
    return {
      industry: opp.company.industry,
      country: opp.company.country,
      employeeCount: opp.company.employeeCount,
      companySize: opp.company.size ?? opp.company.employeeRange,
      signalType: opp.primarySignal?.type,
      contactTitle: opp.primaryContact?.title,
      serviceId: opp.recommendedServiceId,
      serviceName: opp.recommendedService?.name,
      offerId: opp.recommendedOfferId,
      offerName: opp.recommendedOffer?.name,
      score: opp.score,
      stage: opp.stage,
      estimatedValue: opp.estimatedValue
        ? Number(opp.estimatedValue)
        : null,
    };
  }
}

export const learningService = new LearningService();
