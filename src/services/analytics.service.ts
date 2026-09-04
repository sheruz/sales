import prisma from "@/lib/db/prisma";
import {
  OpportunityStage,
  OpportunityStatus,
  RevenueStatus,
  MessageDirection,
} from "@prisma/client";
import { dealStageProbability } from "@/lib/crm/pipeline";

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return Number(v) || 0;
}

function conversionRate(wins: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((wins / total) * 1000) / 10;
}

export class AnalyticsService {
  async getRevenueDashboard(organizationId: string) {
    const [
      activeGoal,
      revenueAgg,
      opportunities,
      meetings,
      proposals,
      wonDeals,
      lostDeals,
      outboundMessages,
      repliedOpps,
    ] = await Promise.all([
      prisma.revenueGoal.findFirst({
        where: { organizationId, status: "ACTIVE" },
        orderBy: { endDate: "asc" },
      }),
      prisma.revenue.aggregate({
        where: {
          organizationId,
          status: RevenueStatus.RECOGNIZED,
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.opportunity.findMany({
        where: { organizationId },
        select: {
          id: true,
          stage: true,
          status: true,
          score: true,
          estimatedValue: true,
          currency: true,
          createdAt: true,
          recommendedServiceId: true,
          recommendedOfferId: true,
          campaignId: true,
          primaryContactId: true,
          companyId: true,
          primarySignal: { select: { type: true } },
          company: {
            select: { industry: true, employeeCount: true, country: true },
          },
          primaryContact: { select: { title: true } },
          deals: {
            where: { deletedAt: null },
            select: {
              estimatedValue: true,
              probability: true,
              stage: true,
              wonAt: true,
              actualCloseDate: true,
            },
            take: 1,
          },
        },
        take: 2000,
      }),
      prisma.meeting.count({ where: { organizationId } }),
      prisma.proposal.count({ where: { organizationId } }),
      prisma.deal.findMany({
        where: { organizationId, deletedAt: null, stage: "WON" },
        select: {
          estimatedValue: true,
          createdAt: true,
          wonAt: true,
          actualCloseDate: true,
        },
      }),
      prisma.deal.count({
        where: { organizationId, deletedAt: null, stage: "LOST" },
      }),
      prisma.message.count({
        where: { organizationId, direction: MessageDirection.OUTBOUND },
      }),
      prisma.opportunity.count({
        where: {
          organizationId,
          stage: {
            in: [
              OpportunityStage.REPLIED,
              OpportunityStage.DISCOVERY,
              OpportunityStage.MEETING,
              OpportunityStage.PROPOSAL,
              OpportunityStage.NEGOTIATION,
              OpportunityStage.WON,
            ],
          },
        },
      }),
    ]);

    const revenueAchieved = num(revenueAgg._sum.amount);
    const revenueTarget = activeGoal ? num(activeGoal.targetRevenue) : 0;

    let pipelineValue = 0;
    let weightedPipeline = 0;
    let qualified = 0;

    const funnel: Record<string, number> = {
      Opportunities: 0,
      Qualified: 0,
      Contacted: 0,
      Replied: 0,
      Meeting: 0,
      Proposal: 0,
      Negotiation: 0,
      Won: 0,
    };

    for (const opp of opportunities) {
      funnel.Opportunities += 1;
      const value = num(opp.estimatedValue ?? opp.deals[0]?.estimatedValue);
      if (
        opp.status === OpportunityStatus.OPEN &&
        opp.stage !== OpportunityStage.LOST &&
        opp.stage !== OpportunityStage.WON
      ) {
        pipelineValue += value;
        const deal = opp.deals[0];
        const prob = deal
          ? deal.probability / 100
          : dealStageProbability(
              opp.stage === OpportunityStage.NEGOTIATION
                ? "NEGOTIATION"
                : opp.stage === OpportunityStage.PROPOSAL
                  ? "PROPOSAL"
                  : opp.stage === OpportunityStage.MEETING
                    ? "MEETING"
                    : "QUALIFIED"
            ) / 100;
        weightedPipeline += value * prob;
      }

      if (opp.stage !== OpportunityStage.NEW) qualified += 1;

      switch (opp.stage) {
        case OpportunityStage.QUALIFIED:
        case OpportunityStage.DISCOVERY:
          funnel.Qualified += 1;
          break;
        case OpportunityStage.CONTACTED:
          funnel.Contacted += 1;
          break;
        case OpportunityStage.REPLIED:
          funnel.Replied += 1;
          break;
        case OpportunityStage.MEETING:
          funnel.Meeting += 1;
          break;
        case OpportunityStage.PROPOSAL:
          funnel.Proposal += 1;
          break;
        case OpportunityStage.NEGOTIATION:
          funnel.Negotiation += 1;
          break;
        case OpportunityStage.WON:
          funnel.Won += 1;
          break;
        default:
          break;
      }
      // Cumulative funnel: count how many reached at least each stage
    }

    // Rebuild funnel as cumulative reach counts
    const stageOrder: OpportunityStage[] = [
      OpportunityStage.NEW,
      OpportunityStage.QUALIFIED,
      OpportunityStage.CONTACTED,
      OpportunityStage.REPLIED,
      OpportunityStage.MEETING,
      OpportunityStage.PROPOSAL,
      OpportunityStage.NEGOTIATION,
      OpportunityStage.WON,
    ];
    const stageRank = (s: OpportunityStage) => {
      const i = stageOrder.indexOf(s);
      if (s === OpportunityStage.DISCOVERY) return stageOrder.indexOf(OpportunityStage.QUALIFIED);
      if (s === OpportunityStage.LOST) return -1;
      return i;
    };

    const cumulative = {
      Opportunities: opportunities.length,
      Qualified: opportunities.filter((o) => stageRank(o.stage) >= 1).length,
      Contacted: opportunities.filter((o) => stageRank(o.stage) >= 2).length,
      Replied: opportunities.filter((o) => stageRank(o.stage) >= 3).length,
      Meeting: opportunities.filter((o) => stageRank(o.stage) >= 4).length,
      Proposal: opportunities.filter((o) => stageRank(o.stage) >= 5).length,
      Negotiation: opportunities.filter((o) => stageRank(o.stage) >= 6).length,
      Won: opportunities.filter((o) => o.stage === OpportunityStage.WON).length,
    };

    const dealsWon = wonDeals.length;
    const closed = dealsWon + lostDeals;
    const winRate = conversionRate(dealsWon, closed);
    const avgDealSize =
      dealsWon > 0
        ? wonDeals.reduce((s, d) => s + num(d.estimatedValue), 0) / dealsWon
        : 0;

    const cycles = wonDeals
      .map((d) => {
        const end = d.actualCloseDate ?? d.wonAt;
        if (!end) return null;
        return (end.getTime() - d.createdAt.getTime()) / 86400000;
      })
      .filter((n): n is number => n != null && n >= 0);
    const salesCycleDays =
      cycles.length > 0
        ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length)
        : 0;

    const replyRate = conversionRate(repliedOpps, outboundMessages || opportunities.length);

    return {
      revenueTarget,
      revenueAchieved,
      revenueProgress:
        revenueTarget > 0
          ? Math.round((revenueAchieved / revenueTarget) * 1000) / 10
          : null,
      currency: activeGoal?.currency ?? "USD",
      goalName: activeGoal?.name ?? null,
      pipelineValue: Math.round(pipelineValue),
      weightedPipeline: Math.round(weightedPipeline),
      opportunities: opportunities.length,
      qualifiedOpportunities: qualified,
      meetings,
      proposals,
      dealsWon,
      winRate,
      averageDealSize: Math.round(avgDealSize),
      salesCycleDays,
      outreachReplyRate: replyRate,
      funnel: cumulative,
      currentStageCounts: funnel,
    };
  }

  async getSourceAnalytics(organizationId: string) {
    const opps = await prisma.opportunity.findMany({
      where: { organizationId },
      select: {
        id: true,
        stage: true,
        estimatedValue: true,
        primarySignal: { select: { type: true } },
        source: { select: { key: true, name: true } },
        deals: {
          where: { deletedAt: null, stage: "WON" },
          select: { estimatedValue: true },
        },
        meetings: { select: { id: true }, take: 1 },
      },
      take: 2000,
    });

    const buckets = new Map<
      string,
      {
        source: string;
        opportunities: number;
        meetings: number;
        deals: number;
        revenue: number;
        totalValue: number;
      }
    >();

    const labelFor = (opp: (typeof opps)[0]) => {
      const t = opp.primarySignal?.type;
      if (t === "HIRING" || t === "JOB_GROWTH") return "hiring";
      if (t === "FUNDING") return "funding";
      if (t === "RFP" || t === "TENDER") return "RFP";
      if (t === "WEBSITE_CHANGE" || t === "TECHNOLOGY_CHANGE" || t === "NEWS")
        return "web signals";
      if (t === "CRM_ACTIVITY") return "CRM";
      if (opp.source?.key?.includes("csv") || opp.source?.key?.includes("import"))
        return "imports";
      return opp.source?.name || t || "other";
    };

    for (const opp of opps) {
      const key = labelFor(opp);
      const row = buckets.get(key) ?? {
        source: key,
        opportunities: 0,
        meetings: 0,
        deals: 0,
        revenue: 0,
        totalValue: 0,
      };
      row.opportunities += 1;
      if (opp.meetings.length) row.meetings += 1;
      if (opp.deals.length) {
        row.deals += 1;
        row.revenue += num(opp.deals[0].estimatedValue);
      }
      row.totalValue += num(opp.estimatedValue);
      buckets.set(key, row);
    }

    return Array.from(buckets.values()).map((r) => ({
      ...r,
      conversion: conversionRate(r.deals, r.opportunities),
      averageDealValue:
        r.deals > 0 ? Math.round(r.revenue / r.deals) : 0,
    }));
  }

  async getServiceAnalytics(organizationId: string) {
    const [services, opps] = await Promise.all([
      prisma.service.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      }),
      prisma.opportunity.findMany({
        where: { organizationId, recommendedServiceId: { not: null } },
        select: {
          recommendedServiceId: true,
          stage: true,
          estimatedValue: true,
          meetings: { select: { id: true }, take: 1 },
          proposals: { select: { id: true }, take: 1 },
          deals: {
            where: { deletedAt: null, stage: "WON" },
            select: { estimatedValue: true },
          },
        },
        take: 2000,
      }),
    ]);

    const map = new Map(
      services.map((s) => [
        s.id,
        {
          serviceId: s.id,
          serviceName: s.name,
          opportunities: 0,
          meetings: 0,
          proposals: 0,
          wins: 0,
          revenue: 0,
        },
      ])
    );

    for (const opp of opps) {
      const id = opp.recommendedServiceId!;
      const row = map.get(id);
      if (!row) continue;
      row.opportunities += 1;
      if (opp.meetings.length) row.meetings += 1;
      if (opp.proposals.length) row.proposals += 1;
      if (opp.deals.length) {
        row.wins += 1;
        row.revenue += num(opp.deals[0].estimatedValue);
      }
    }

    return Array.from(map.values())
      .filter((r) => r.opportunities > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }

  async getConversionBreakdowns(organizationId: string) {
    const opps = await prisma.opportunity.findMany({
      where: { organizationId },
      select: {
        stage: true,
        recommendedOfferId: true,
        campaignId: true,
        primaryContact: { select: { title: true } },
        deals: {
          where: { deletedAt: null, stage: "WON" },
          select: { id: true },
        },
      },
      take: 2000,
    });

    const byTitle = new Map<string, { total: number; wins: number }>();
    const byOffer = new Map<string, { total: number; wins: number }>();
    const byCampaign = new Map<string, { total: number; wins: number }>();

    for (const opp of opps) {
      const title = (opp.primaryContact?.title || "Unknown").slice(0, 80);
      const t = byTitle.get(title) ?? { total: 0, wins: 0 };
      t.total += 1;
      if (opp.deals.length) t.wins += 1;
      byTitle.set(title, t);

      if (opp.recommendedOfferId) {
        const o = byOffer.get(opp.recommendedOfferId) ?? { total: 0, wins: 0 };
        o.total += 1;
        if (opp.deals.length) o.wins += 1;
        byOffer.set(opp.recommendedOfferId, o);
      }

      if (opp.campaignId) {
        const c = byCampaign.get(opp.campaignId) ?? { total: 0, wins: 0 };
        c.total += 1;
        if (opp.deals.length) c.wins += 1;
        byCampaign.set(opp.campaignId, c);
      }
    }

    const offerNames = await prisma.offer.findMany({
      where: { organizationId, id: { in: Array.from(byOffer.keys()) } },
      select: { id: true, name: true },
    });
    const offerNameMap = new Map(offerNames.map((o) => [o.id, o.name]));

    const campaignNames = await prisma.campaign.findMany({
      where: { organizationId, id: { in: Array.from(byCampaign.keys()) } },
      select: { id: true, name: true },
    });
    const campaignNameMap = new Map(campaignNames.map((c) => [c.id, c.name]));

    return {
      contactTitle: Array.from(byTitle.entries())
        .map(([title, v]) => ({
          title,
          opportunities: v.total,
          wins: v.wins,
          conversion: conversionRate(v.wins, v.total),
        }))
        .sort((a, b) => b.conversion - a.conversion)
        .slice(0, 15),
      offer: Array.from(byOffer.entries()).map(([id, v]) => ({
        offerId: id,
        offerName: offerNameMap.get(id) ?? id,
        opportunities: v.total,
        wins: v.wins,
        conversion: conversionRate(v.wins, v.total),
      })),
      campaign: Array.from(byCampaign.entries()).map(([id, v]) => ({
        campaignId: id,
        campaignName: campaignNameMap.get(id) ?? id,
        opportunities: v.total,
        wins: v.wins,
        conversion: conversionRate(v.wins, v.total),
      })),
    };
  }

  async getFullAnalytics(organizationId: string) {
    const [dashboard, sources, services, conversions] = await Promise.all([
      this.getRevenueDashboard(organizationId),
      this.getSourceAnalytics(organizationId),
      this.getServiceAnalytics(organizationId),
      this.getConversionBreakdowns(organizationId),
    ]);
    return { dashboard, sources, services, conversions };
  }
}

export const analyticsService = new AnalyticsService();
