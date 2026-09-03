import prisma from "@/lib/db/prisma";
import {
  ContactStatus,
  OpportunityEventType,
  OpportunityStage,
  OpportunityStatus,
  SignalStatus,
  SignalType,
  type Prisma,
} from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { businessBrainService } from "@/services/business-brain.service";
import { companyService, extractDomain } from "@/services/company.service";

export type OpportunityListFilter =
  | "all"
  | "hot"
  | "warm"
  | "new"
  | "needs_action"
  | "contacted"
  | "replied"
  | "meeting"
  | "proposal"
  | "won"
  | "lost";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export class OpportunityService {
  async ensureSource(organizationId: string, key: string, name: string) {
    return prisma.opportunitySource.upsert({
      where: { organizationId_key: { organizationId, key } },
      create: { organizationId, key, name },
      update: { name, isActive: true },
    });
  }

  async list(
    organizationId: string,
    opts: {
      filter?: OpportunityListFilter;
      search?: string;
      page?: number;
      limit?: number;
      ownerId?: string;
    } = {}
  ) {
    const page = opts.page ?? 1;
    const limit = Math.min(opts.limit ?? 25, 100);
    const filter = opts.filter ?? "all";

    const where: Prisma.OpportunityWhereInput = {
      organizationId,
      ...(opts.ownerId ? { ownerId: opts.ownerId } : {}),
      ...(opts.search
        ? {
            OR: [
              { whyNow: { contains: opts.search, mode: "insensitive" } },
              { likelyProblem: { contains: opts.search, mode: "insensitive" } },
              {
                company: {
                  name: { contains: opts.search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };

    switch (filter) {
      case "hot":
        where.status = OpportunityStatus.OPEN;
        where.score = { gte: 75 };
        break;
      case "warm":
        where.status = OpportunityStatus.OPEN;
        where.score = { gte: 50, lt: 75 };
        break;
      case "new":
        where.stage = OpportunityStage.NEW;
        where.status = OpportunityStatus.OPEN;
        break;
      case "needs_action":
        where.status = OpportunityStatus.OPEN;
        where.OR = [
          { nextActionAt: { lte: new Date() } },
          { nextActionAt: null, stage: OpportunityStage.NEW },
        ];
        break;
      case "contacted":
        where.stage = OpportunityStage.CONTACTED;
        break;
      case "replied":
        where.stage = OpportunityStage.REPLIED;
        break;
      case "meeting":
        where.stage = OpportunityStage.MEETING;
        break;
      case "proposal":
        where.stage = OpportunityStage.PROPOSAL;
        break;
      case "won":
        where.status = OpportunityStatus.WON;
        break;
      case "lost":
        where.status = OpportunityStatus.LOST;
        break;
      default:
        break;
    }

    const [items, total] = await Promise.all([
      prisma.opportunity.findMany({
        where,
        include: {
          company: true,
          primaryContact: true,
          primarySignal: true,
          recommendedService: { select: { id: true, name: true } },
          owner: { select: { id: true, firstName: true, lastName: true } },
          scores: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.opportunity.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(organizationId: string, id: string) {
    const opportunity = await prisma.opportunity.findFirst({
      where: { id, organizationId },
      include: {
        company: {
          include: {
            contacts: { orderBy: { createdAt: "desc" }, take: 20 },
            signals: { orderBy: { detectedAt: "desc" }, take: 20 },
          },
        },
        primaryContact: true,
        primarySignal: true,
        recommendedService: true,
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        campaign: { select: { id: true, name: true } },
        source: true,
        scores: { orderBy: { createdAt: "desc" }, take: 5 },
        events: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            actor: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        lead: {
          include: {
            conversations: { orderBy: { createdAt: "desc" }, take: 20 },
            tasks: { orderBy: { dueDate: "asc" }, take: 20 },
            meetings: { orderBy: { date: "desc" }, take: 10 },
            proposals: { orderBy: { createdAt: "desc" }, take: 10 },
            deals: { where: { deletedAt: null }, take: 5 },
            activities: { orderBy: { createdAt: "desc" }, take: 20 },
          },
        },
      },
    });
    if (!opportunity) throw new NotFoundError("Opportunity not found");
    return opportunity;
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      stage: OpportunityStage;
      status: OpportunityStatus;
      ownerId: string | null;
      recommendedAction: string | null;
      nextActionAt: Date | null;
      whyNow: string | null;
      likelyProblem: string | null;
      recommendedServiceId: string | null;
    }>,
    actorId?: string
  ) {
    const existing = await prisma.opportunity.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundError("Opportunity not found");

    const updated = await prisma.opportunity.update({
      where: { id },
      data,
    });

    if (data.stage && data.stage !== existing.stage) {
      await this.addEvent(organizationId, id, OpportunityEventType.STAGE_CHANGED, {
        title: `Stage → ${data.stage}`,
        actorId,
        metadata: { from: existing.stage, to: data.stage },
      });
      if (data.stage === OpportunityStage.WON) {
        await prisma.opportunity.update({
          where: { id },
          data: { status: OpportunityStatus.WON },
        });
        await this.addEvent(organizationId, id, OpportunityEventType.WON, {
          actorId,
        });
      }
      if (data.stage === OpportunityStage.LOST) {
        await prisma.opportunity.update({
          where: { id },
          data: { status: OpportunityStatus.LOST },
        });
        await this.addEvent(organizationId, id, OpportunityEventType.LOST, {
          actorId,
        });
      }
    }

    if (data.ownerId !== undefined && data.ownerId !== existing.ownerId) {
      await this.addEvent(organizationId, id, OpportunityEventType.OWNER_CHANGED, {
        title: "Owner changed",
        actorId,
        metadata: { from: existing.ownerId, to: data.ownerId },
      });
    }

    return updated;
  }

  async addEvent(
    organizationId: string,
    opportunityId: string,
    type: OpportunityEventType,
    opts?: {
      title?: string;
      description?: string;
      metadata?: unknown;
      actorId?: string;
    }
  ) {
    return prisma.opportunityEvent.create({
      data: {
        organizationId,
        opportunityId,
        type,
        title: opts?.title,
        description: opts?.description,
        metadata: opts?.metadata as Prisma.InputJsonValue | undefined,
        actorId: opts?.actorId,
      },
    });
  }

  /**
   * Score opportunity from signal + ICP/services context.
   * Stores opportunity_scores row and updates opportunity.score.
   */
  async scoreOpportunity(
    organizationId: string,
    opportunityId: string,
    extras?: {
      signalConfidence?: number;
      leadScore?: number;
      budgetHint?: string | null;
    }
  ) {
    const opp = await prisma.opportunity.findFirst({
      where: { id: opportunityId, organizationId },
      include: {
        company: true,
        primarySignal: true,
        primaryContact: true,
      },
    });
    if (!opp) throw new NotFoundError("Opportunity not found");

    const context = await businessBrainService.getSafeContext(organizationId);
    const companyIndustry = (opp.company.industry || "").toLowerCase();
    const companyCountry = (opp.company.country || "").toLowerCase();

    let icpFit = 40;
    for (const icp of context.icps) {
      let fit = 40;
      if (
        companyIndustry &&
        icp.industries.some((i) => companyIndustry.includes(i.toLowerCase()))
      ) {
        fit += 25;
      }
      if (
        companyCountry &&
        (icp.countries.some((c) => companyCountry.includes(c.toLowerCase())) ||
          icp.regions.some((r) => companyCountry.includes(r.toLowerCase())))
      ) {
        fit += 20;
      }
      icpFit = Math.max(icpFit, fit);
    }

    const signalStrength = clamp(extras?.signalConfidence ?? opp.primarySignal?.confidence ?? 55);
    const detected = opp.primarySignal?.detectedAt ?? opp.createdAt;
    const ageHours = (Date.now() - detected.getTime()) / 36e5;
    const freshness = clamp(100 - ageHours * 2);
    const urgency = clamp(opp.urgency || signalStrength * 0.8);
    const budgetPotential = extras?.budgetHint ? 70 : 45;
    const growth = opp.company.employeeCount && opp.company.employeeCount > 50 ? 65 : 45;

    let serviceFit = 40;
    if (context.services.length > 0) {
      serviceFit = 55;
      const problem = (opp.likelyProblem || "").toLowerCase();
      for (const s of context.services) {
        if (
          s.problemsSolved.some((p) => problem.includes(p.toLowerCase())) ||
          problem.includes(s.name.toLowerCase())
        ) {
          serviceFit = 80;
          break;
        }
      }
    }

    const reachability = opp.primaryContact?.email ? 75 : 35;
    const historicalConversion = 50;
    const leadBoost = extras?.leadScore ? extras.leadScore * 0.15 : 0;

    const totalScore = clamp(
      icpFit * 0.2 +
        signalStrength * 0.2 +
        freshness * 0.1 +
        urgency * 0.1 +
        budgetPotential * 0.1 +
        growth * 0.05 +
        serviceFit * 0.15 +
        reachability * 0.05 +
        historicalConversion * 0.05 +
        leadBoost
    );

    const explanation = [
      `ICP fit ${icpFit}`,
      `signal ${signalStrength}`,
      `freshness ${freshness}`,
      `service fit ${serviceFit}`,
      `reachability ${reachability}`,
    ].join(" · ");

    const scoreRow = await prisma.opportunityScore.create({
      data: {
        organizationId,
        opportunityId,
        totalScore,
        icpFit: clamp(icpFit),
        signalStrength,
        freshness,
        urgency,
        budgetPotential,
        growth,
        serviceFit,
        reachability,
        historicalConversion,
        explanation,
        model: "rules_v1",
      },
    });

    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        score: totalScore,
        confidence: clamp((signalStrength + icpFit) / 2),
        urgency,
      },
    });

    await this.addEvent(organizationId, opportunityId, OpportunityEventType.SCORED, {
      title: `Score ${totalScore}`,
      description: explanation,
      metadata: { scoreId: scoreRow.id, totalScore },
    });

    return scoreRow;
  }

  /**
   * Core Phase 3 path: job post (or any hiring signal) → company + signal → opportunity.
   * Optionally links a legacy Lead for automation/conversations.
   */
  async ingestHiringSignal(input: {
    organizationId: string;
    userId: string;
    campaignId?: string | null;
    companyName: string;
    companyWebsite?: string | null;
    industry?: string | null;
    country?: string | null;
    companySummary?: string | null;
    contact?: {
      firstName: string;
      lastName: string;
      email?: string | null;
      title?: string | null;
      linkedInUrl?: string | null;
    };
    signal: {
      title: string;
      description?: string | null;
      evidenceUrl?: string | null;
      evidenceText?: string | null;
      confidence?: number;
      rawData?: unknown;
    };
    whyNow?: string | null;
    likelyProblem?: string | null;
    recommendedAction?: string | null;
    estimatedValue?: number | null;
    leadScore?: number;
    budgetHint?: string | null;
    leadId?: string | null;
  }) {
    const source = await this.ensureSource(
      input.organizationId,
      "job_post",
      "Job posts"
    );

    const company = await companyService.findOrCreate(
      input.organizationId,
      input.companyName,
      {
        website: input.companyWebsite ?? undefined,
        domain: extractDomain(input.companyWebsite) ?? undefined,
        industry: input.industry ?? undefined,
        country: input.country ?? undefined,
        description: input.companySummary ?? undefined,
        source: "job_post",
      }
    );

    let contactId: string | null = null;
    if (input.contact) {
      const fullName = `${input.contact.firstName} ${input.contact.lastName}`.trim();
      const existingContact = input.contact.email
        ? await prisma.contact.findFirst({
            where: {
              organizationId: input.organizationId,
              companyId: company.id,
              email: input.contact.email.toLowerCase(),
            },
          })
        : null;

      const contact =
        existingContact ??
        (await prisma.contact.create({
          data: {
            organizationId: input.organizationId,
            companyId: company.id,
            firstName: input.contact.firstName,
            lastName: input.contact.lastName,
            fullName,
            title: input.contact.title,
            email: input.contact.email?.toLowerCase() || null,
            linkedInUrl: input.contact.linkedInUrl,
            source: "job_post",
            status: ContactStatus.ACTIVE,
            leadId: input.leadId || null,
          },
        }));

      if (existingContact && input.leadId && !existingContact.leadId) {
        await prisma.contact.update({
          where: { id: existingContact.id },
          data: { leadId: input.leadId },
        });
      }

      contactId = contact.id;
    }

    const signal = await prisma.signal.create({
      data: {
        organizationId: input.organizationId,
        companyId: company.id,
        sourceId: source.id,
        type: SignalType.HIRING,
        title: input.signal.title,
        description: input.signal.description,
        evidenceUrl: input.signal.evidenceUrl,
        evidenceText: input.signal.evidenceText,
        confidence: clamp(input.signal.confidence ?? 60),
        status: SignalStatus.ACTIVE,
        rawData: input.signal.rawData as Prisma.InputJsonValue | undefined,
        occurredAt: new Date(),
      },
    });

    // Reuse open opportunity for same company when recent hiring signal exists
    let opportunity = await prisma.opportunity.findFirst({
      where: {
        organizationId: input.organizationId,
        companyId: company.id,
        status: OpportunityStatus.OPEN,
      },
      orderBy: { updatedAt: "desc" },
    });

    const whyNow =
      input.whyNow ||
      `Hiring signal: ${input.signal.title}`;
    const likelyProblem =
      input.likelyProblem ||
      input.signal.description ||
      "Team is hiring — may need external delivery capacity or specialized skills.";
    const recommendedAction =
      input.recommendedAction ||
      "Research decision maker, personalize outreach around the open role, and propose a relevant service.";

    // Pick best matching service by name heuristics
    const ctx = await businessBrainService.getSafeContext(input.organizationId);
    const recommendedServiceId =
      ctx.services.find((s) =>
        (input.signal.title + " " + (input.signal.description || ""))
          .toLowerCase()
          .includes(s.name.toLowerCase().split(" ")[0] || "___")
      )?.id ?? ctx.services[0]?.id ?? null;

    if (!opportunity) {
      opportunity = await prisma.opportunity.create({
        data: {
          organizationId: input.organizationId,
          companyId: company.id,
          primaryContactId: contactId,
          sourceId: source.id,
          primarySignalId: signal.id,
          leadId: input.leadId || null,
          status: OpportunityStatus.OPEN,
          stage: OpportunityStage.NEW,
          whyNow,
          likelyProblem,
          recommendedAction,
          recommendedServiceId,
          recommendedContactReason: contactId
            ? "Listed or associated with the hiring signal"
            : null,
          estimatedValue: input.estimatedValue,
          lastSignalAt: signal.detectedAt,
          nextActionAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          ownerId: input.userId,
          campaignId: input.campaignId || null,
        },
      });

      await this.addEvent(
        input.organizationId,
        opportunity.id,
        OpportunityEventType.CREATED,
        {
          title: "Opportunity created from hiring signal",
          actorId: input.userId,
          metadata: { signalId: signal.id, companyId: company.id },
        }
      );
    } else {
      opportunity = await prisma.opportunity.update({
        where: { id: opportunity.id },
        data: {
          primarySignalId: signal.id,
          primaryContactId: contactId ?? opportunity.primaryContactId,
          leadId: input.leadId ?? opportunity.leadId,
          whyNow,
          likelyProblem,
          recommendedAction,
          recommendedServiceId:
            recommendedServiceId ?? opportunity.recommendedServiceId,
          lastSignalAt: signal.detectedAt,
          campaignId: input.campaignId ?? opportunity.campaignId,
        },
      });

      await this.addEvent(
        input.organizationId,
        opportunity.id,
        OpportunityEventType.SIGNAL_ADDED,
        {
          title: signal.title,
          actorId: input.userId,
          metadata: { signalId: signal.id },
        }
      );
    }

    await this.scoreOpportunity(input.organizationId, opportunity.id, {
      signalConfidence: signal.confidence,
      leadScore: input.leadScore,
      budgetHint: input.budgetHint,
    });

    await prisma.signal.update({
      where: { id: signal.id },
      data: { status: SignalStatus.CONSUMED },
    });

    return {
      companyId: company.id,
      contactId,
      signalId: signal.id,
      opportunityId: opportunity.id,
    };
  }

  async createManual(
    organizationId: string,
    userId: string,
    input: {
      companyId: string;
      primaryContactId?: string;
      whyNow?: string;
      likelyProblem?: string;
      recommendedAction?: string;
      estimatedValue?: number;
    }
  ) {
    const company = await prisma.company.findFirst({
      where: { id: input.companyId, organizationId, deletedAt: null },
    });
    if (!company) throw new ValidationError("Company not found");

    const source = await this.ensureSource(organizationId, "manual", "Manual");

    const opportunity = await prisma.opportunity.create({
      data: {
        organizationId,
        companyId: input.companyId,
        primaryContactId: input.primaryContactId,
        sourceId: source.id,
        whyNow: input.whyNow,
        likelyProblem: input.likelyProblem,
        recommendedAction: input.recommendedAction,
        estimatedValue: input.estimatedValue,
        ownerId: userId,
        lastSignalAt: new Date(),
        nextActionAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await this.addEvent(organizationId, opportunity.id, OpportunityEventType.CREATED, {
      title: "Manually created",
      actorId: userId,
    });
    await this.scoreOpportunity(organizationId, opportunity.id);

    return opportunity;
  }
}

export const opportunityService = new OpportunityService();
