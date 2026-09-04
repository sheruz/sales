import prisma from "@/lib/db/prisma";
import {
  DealStage,
  OpportunityEventType,
  OpportunityStage,
  OpportunityStatus,
  RevenueSource,
  RevenueStatus,
  type Prisma,
} from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import {
  dealStageProbability,
  opportunityStageToDealStage,
  PIPELINE_STAGES,
} from "@/lib/crm/pipeline";

export class DealService {
  async list(organizationId: string, filters?: { stage?: DealStage }) {
    return prisma.deal.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(filters?.stage ? { stage: filters.stage } : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        primaryContact: { select: { id: true, fullName: true, email: true } },
        opportunity: { select: { id: true, stage: true, score: true } },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
        revenueEntries: { where: { status: RevenueStatus.RECOGNIZED }, take: 5 },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
  }

  async getById(organizationId: string, id: string) {
    const deal = await prisma.deal.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        company: true,
        primaryContact: true,
        opportunity: true,
        lead: { select: { id: true, fullName: true, email: true } },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        activities: { orderBy: { createdAt: "desc" }, take: 50 },
        proposals: { orderBy: { updatedAt: "desc" }, take: 20 },
        meetings: { orderBy: { date: "desc" }, take: 20 },
        revenueEntries: { orderBy: { recognizedAt: "desc" } },
      },
    });
    if (!deal) throw new NotFoundError("Deal not found");
    return deal;
  }

  async ensureForOpportunity(
    organizationId: string,
    opportunityId: string,
    actorId?: string
  ) {
    const opportunity = await prisma.opportunity.findFirst({
      where: { id: opportunityId, organizationId },
      include: {
        company: true,
        primaryContact: true,
        recommendedContact: true,
      },
    });
    if (!opportunity) throw new NotFoundError("Opportunity not found");

    const existing = await prisma.deal.findFirst({
      where: { organizationId, opportunityId, deletedAt: null },
    });
    if (existing) return existing;

    const stage = opportunityStageToDealStage(opportunity.stage);
    const value = opportunity.estimatedValue ?? 0;

    return prisma.deal.create({
      data: {
        organizationId,
        opportunityId,
        leadId: opportunity.leadId,
        companyId: opportunity.companyId,
        primaryContactId:
          opportunity.primaryContactId ?? opportunity.recommendedContactId,
        assignedToId: opportunity.ownerId ?? actorId,
        name: `${opportunity.company.name} — Deal`,
        estimatedValue: value,
        currency: opportunity.currency,
        stage,
        probability: dealStageProbability(stage),
      },
    });
  }

  async create(
    organizationId: string,
    input: {
      name: string;
      opportunityId?: string | null;
      leadId?: string | null;
      companyId?: string | null;
      primaryContactId?: string | null;
      assignedToId?: string | null;
      estimatedValue: number;
      currency?: string;
      stage?: DealStage;
      expectedCloseDate?: string | null;
      notes?: string | null;
    },
    actorId?: string
  ) {
    if (!input.name.trim()) throw new ValidationError("Deal name required");
    if (!input.opportunityId && !input.leadId) {
      throw new ValidationError("opportunityId or leadId required");
    }

    let companyId = input.companyId;
    let primaryContactId = input.primaryContactId;
    let leadId = input.leadId;
    let stage = input.stage ?? DealStage.QUALIFIED;

    if (input.opportunityId) {
      const opp = await prisma.opportunity.findFirst({
        where: { id: input.opportunityId, organizationId },
      });
      if (!opp) throw new NotFoundError("Opportunity not found");
      companyId = companyId ?? opp.companyId;
      primaryContactId = primaryContactId ?? opp.primaryContactId;
      leadId = leadId ?? opp.leadId;
      stage = input.stage ?? opportunityStageToDealStage(opp.stage);
    }

    const deal = await prisma.deal.create({
      data: {
        organizationId,
        name: input.name.trim(),
        opportunityId: input.opportunityId,
        leadId,
        companyId,
        primaryContactId,
        assignedToId: input.assignedToId ?? actorId,
        estimatedValue: input.estimatedValue,
        currency: input.currency ?? "USD",
        stage,
        probability: dealStageProbability(stage),
        expectedCloseDate: input.expectedCloseDate
          ? new Date(input.expectedCloseDate)
          : null,
        notes: input.notes,
      },
    });

    await prisma.dealActivity.create({
      data: { dealId: deal.id, toStage: stage, notes: "Deal created" },
    });

    return deal;
  }

  async updateStage(
    organizationId: string,
    id: string,
    stage: DealStage,
    opts?: { lostReason?: string; wonReason?: string; actorId?: string }
  ) {
    const deal = await this.getById(organizationId, id);
    if (deal.stage === stage) return deal;

    const data: Prisma.DealUpdateInput = {
      stage,
      probability: dealStageProbability(stage),
    };

    if (stage === DealStage.WON) {
      data.wonAt = new Date();
      data.actualCloseDate = new Date();
      data.wonReason = opts?.wonReason ?? deal.wonReason;
      data.lostAt = null;
      data.lostReason = null;
    }
    if (stage === DealStage.LOST) {
      data.lostAt = new Date();
      data.actualCloseDate = new Date();
      data.lostReason = opts?.lostReason ?? deal.lostReason;
      data.wonAt = null;
      data.wonReason = null;
    }

    const updated = await prisma.deal.update({
      where: { id },
      data,
    });

    await prisma.dealActivity.create({
      data: {
        dealId: id,
        fromStage: deal.stage,
        toStage: stage,
        notes: opts?.wonReason || opts?.lostReason || undefined,
      },
    });

    if (deal.opportunityId) {
      const oppStage =
        stage === DealStage.WON
          ? OpportunityStage.WON
          : stage === DealStage.LOST
            ? OpportunityStage.LOST
            : stage === DealStage.DISCOVERY
              ? OpportunityStage.DISCOVERY
              : stage === DealStage.MEETING
                ? OpportunityStage.MEETING
                : stage === DealStage.PROPOSAL
                  ? OpportunityStage.PROPOSAL
                  : stage === DealStage.NEGOTIATION
                    ? OpportunityStage.NEGOTIATION
                    : stage === DealStage.CONTACTED
                      ? OpportunityStage.CONTACTED
                      : stage === DealStage.REPLIED
                        ? OpportunityStage.REPLIED
                        : OpportunityStage.QUALIFIED;

      const opp = await prisma.opportunity.findFirst({
        where: { id: deal.opportunityId, organizationId },
      });
      if (opp && opp.stage !== oppStage) {
        // Direct update to avoid recursion with opportunityService ↔ dealService
        await prisma.opportunity.update({
          where: { id: deal.opportunityId },
          data: {
            stage: oppStage,
            ...(oppStage === OpportunityStage.WON
              ? { status: OpportunityStatus.WON }
              : {}),
            ...(oppStage === OpportunityStage.LOST
              ? { status: OpportunityStatus.LOST }
              : {}),
          },
        });
        await prisma.opportunityEvent.create({
          data: {
            organizationId,
            opportunityId: deal.opportunityId,
            type: OpportunityEventType.STAGE_CHANGED,
            title: `Stage → ${oppStage}`,
            actorId: opts?.actorId,
            metadata: { from: opp.stage, to: oppStage, via: "deal" },
          },
        });
        if (oppStage === OpportunityStage.WON) {
          await prisma.opportunityEvent.create({
            data: {
              organizationId,
              opportunityId: deal.opportunityId,
              type: OpportunityEventType.WON,
              actorId: opts?.actorId,
            },
          });
        }
      }
    }

    if (stage === DealStage.WON) {
      await this.recognizeRevenue(organizationId, id);
    }

    return updated;
  }

  async recognizeRevenue(organizationId: string, dealId: string) {
    const deal = await this.getById(organizationId, dealId);
    const existing = await prisma.revenue.findFirst({
      where: {
        organizationId,
        dealId,
        source: RevenueSource.DEAL_WON,
        status: RevenueStatus.RECOGNIZED,
      },
    });
    if (existing) return existing;

    return prisma.revenue.create({
      data: {
        organizationId,
        dealId,
        amount: deal.estimatedValue,
        currency: deal.currency,
        recognizedAt: deal.actualCloseDate ?? new Date(),
        source: RevenueSource.DEAL_WON,
        status: RevenueStatus.RECOGNIZED,
      },
    });
  }

  /** Opportunity Kanban board grouped by journey stage */
  async pipelineBoard(organizationId: string) {
    const opportunities = await prisma.opportunity.findMany({
      where: {
        organizationId,
        status: { in: [OpportunityStatus.OPEN, OpportunityStatus.WON, OpportunityStatus.LOST] },
      },
      include: {
        company: { select: { id: true, name: true } },
        primaryContact: { select: { id: true, fullName: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
        deals: {
          where: { deletedAt: null },
          take: 1,
          orderBy: { updatedAt: "desc" },
        },
      },
      orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
      take: 300,
    });

    const columns = PIPELINE_STAGES.map((stage) => ({
      stage,
      items: opportunities.filter((o) => o.stage === stage),
    }));

    // Include NEW in a pre-pipeline column
    const newItems = opportunities.filter(
      (o) => o.stage === OpportunityStage.NEW
    );

    return {
      columns: [
        { stage: OpportunityStage.NEW, items: newItems },
        ...columns.filter((c) => c.stage !== OpportunityStage.WON && c.stage !== OpportunityStage.LOST),
        ...columns.filter((c) => c.stage === OpportunityStage.WON || c.stage === OpportunityStage.LOST),
      ],
      totalValue: opportunities.reduce((sum, o) => {
        const v = o.estimatedValue ? Number(o.estimatedValue) : 0;
        return sum + (Number.isFinite(v) ? v : 0);
      }, 0),
    };
  }
}

export const dealService = new DealService();
