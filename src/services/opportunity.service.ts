import prisma from "@/lib/db/prisma";
import {
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
import { contactService } from "@/services/contact.service";
import { entitlementService } from "@/services/entitlement.service";
import { FEATURE_KEYS } from "@/lib/billing/features";

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
        recommendedOffer: {
          include: { service: { select: { id: true, name: true } } },
        },
        recommendedContact: true,
        intelligence: true,
        offerRecommendations: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            offer: {
              include: { service: { select: { id: true, name: true } } },
            },
          },
        },
        deals: {
          where: { deletedAt: null },
          orderBy: { updatedAt: "desc" },
          take: 5,
          include: {
            revenueEntries: { orderBy: { recognizedAt: "desc" }, take: 3 },
          },
        },
        meetings: { orderBy: { date: "desc" }, take: 10 },
        proposals: { orderBy: { updatedAt: "desc" }, take: 10 },
        tasks: {
          orderBy: { dueDate: "asc" },
          take: 20,
          include: {
            assignedTo: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
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
        // Close the revenue path: ensure deal + recognize revenue
        const { dealService } = await import("@/services/deal.service");
        const deal = await dealService.ensureForOpportunity(
          organizationId,
          id,
          actorId
        );
        if (deal.stage !== "WON") {
          await prisma.deal.update({
            where: { id: deal.id },
            data: {
              stage: "WON",
              probability: 100,
              wonAt: new Date(),
              actualCloseDate: new Date(),
            },
          });
          await prisma.dealActivity.create({
            data: {
              dealId: deal.id,
              fromStage: deal.stage,
              toStage: "WON",
              notes: "Won via opportunity stage",
            },
          });
        }
        const revenue = await dealService.recognizeRevenue(organizationId, deal.id);
        const { learningService } = await import("@/services/learning.service");
        const snap = await learningService.snapshotOpportunity(organizationId, id);
        await learningService.record({
          organizationId,
          opportunityId: id,
          eventType: "WON",
          inputContext: snap ?? undefined,
          action: "mark_won",
          result: "won",
          revenue: revenue ? Number(revenue.amount) : Number(deal.estimatedValue),
        });
        await learningService.record({
          organizationId,
          opportunityId: id,
          eventType: "REVENUE",
          inputContext: snap ?? undefined,
          action: "recognize_revenue",
          result: "recognized",
          revenue: revenue ? Number(revenue.amount) : Number(deal.estimatedValue),
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
        const { dealService } = await import("@/services/deal.service");
        const deal = await dealService.ensureForOpportunity(
          organizationId,
          id,
          actorId
        );
        if (deal.stage !== "LOST") {
          await prisma.deal.update({
            where: { id: deal.id },
            data: {
              stage: "LOST",
              probability: 0,
              lostAt: new Date(),
              actualCloseDate: new Date(),
            },
          });
        }
        const { learningService } = await import("@/services/learning.service");
        const snap = await learningService.snapshotOpportunity(organizationId, id);
        await learningService.record({
          organizationId,
          opportunityId: id,
          eventType: "LOST",
          inputContext: snap ?? undefined,
          action: "mark_lost",
          result: "lost",
        });
      }

      // Stage transition learning for mid-funnel
      if (
        data.stage &&
        data.stage !== OpportunityStage.WON &&
        data.stage !== OpportunityStage.LOST
      ) {
        const { learningService } = await import("@/services/learning.service");
        const snap = await learningService.snapshotOpportunity(organizationId, id);
        const typeMap: Partial<
          Record<
            OpportunityStage,
            "CONTACTED" | "REPLIED" | "MEETING" | "PROPOSAL" | "OTHER"
          >
        > = {
          CONTACTED: "CONTACTED",
          REPLIED: "REPLIED",
          MEETING: "MEETING",
          PROPOSAL: "PROPOSAL",
        };
        await learningService.record({
          organizationId,
          opportunityId: id,
          eventType: typeMap[data.stage] ?? "OTHER",
          inputContext: snap ?? undefined,
          action: `stage_${data.stage.toLowerCase()}`,
          result: data.stage,
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

    const icpFitScore = clamp(icpFit);
    const explanation = [
      `ICP Fit: ${icpFitScore}`,
      `Signal Strength: ${signalStrength}`,
      `Urgency: ${urgency}`,
      `Service Fit: ${serviceFit}`,
      `Reachability: ${reachability}`,
      `Freshness: ${freshness}`,
      `Budget Potential: ${budgetPotential}`,
      `Growth: ${growth}`,
      `Historical Conversion: ${historicalConversion}`,
      `Overall: ${totalScore}/100`,
    ].join("\n");

    const scoreRow = await prisma.opportunityScore.create({
      data: {
        organizationId,
        opportunityId,
        totalScore,
        icpFit: icpFitScore,
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
   * Provider-agnostic ingestion. Opportunity Engine does not care about the connector
   * that produced the NormalizedSignalRecord (hiring, funding, CSV, etc.).
   */
  async ingestNormalizedSignal(input: {
    organizationId: string;
    userId: string;
    record: import("@/lib/connectors/types").NormalizedSignalRecord;
    sourceKey: string;
    sourceName: string;
    sourceConnectorId?: string | null;
    sourceRunId?: string | null;
    campaignId?: string | null;
    leadId?: string | null;
    skipDedupe?: boolean;
  }) {
    const { resolveSignalDedupe } = await import("@/lib/connectors/dedupe");
    const { ensureFingerprint } = await import("@/lib/connectors/types");

    const fingerprint = ensureFingerprint(
      input.record,
      input.organizationId
    );
    input.record.fingerprint = fingerprint;

    if (!input.skipDedupe) {
      const decision = await resolveSignalDedupe(
        input.organizationId,
        input.record,
        input.sourceConnectorId
      );
      if (decision.action === "skip") {
        return {
          skipped: true as const,
          reason: decision.reason,
          existingSignalId: decision.existingSignalId,
          companyId: null,
          contactId: null,
          signalId: decision.existingSignalId ?? null,
          opportunityId: null,
        };
      }
    }

    const source = await this.ensureSource(
      input.organizationId,
      input.sourceKey,
      input.sourceName
    );

    const company = await companyService.findOrCreate(
      input.organizationId,
      input.record.company.name,
      {
        website: input.record.company.website ?? undefined,
        domain:
          input.record.company.domain ??
          extractDomain(input.record.company.website) ??
          undefined,
        industry: input.record.company.industry ?? undefined,
        country: input.record.company.country ?? undefined,
        city: input.record.company.city ?? undefined,
        description: input.record.company.description ?? undefined,
        technologies: input.record.company.technologies,
        source: input.sourceKey,
      }
    );

    let contactId: string | null = null;
    if (input.record.contact) {
      const c = input.record.contact;
      const contact = await contactService.findOrCreate(
        input.organizationId,
        company.id,
        {
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          title: c.title,
          phone: c.phone,
          linkedInUrl: c.linkedInUrl,
          source: input.sourceKey,
          leadId: input.leadId || null,
        }
      );
      // Preserve department/seniority on fresh creates via update when provided
      if (c.department || c.seniority) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            department: c.department ?? undefined,
            seniority: c.seniority ?? undefined,
          },
        });
      }
      contactId = contact.id;
    }

    const signal = await prisma.signal.create({
      data: {
        organizationId: input.organizationId,
        companyId: company.id,
        sourceId: source.id,
        sourceConnectorId: input.sourceConnectorId || null,
        sourceRunId: input.sourceRunId || null,
        type: input.record.signalType,
        title: input.record.title,
        description: input.record.description,
        evidenceUrl: input.record.evidenceUrl,
        evidenceText: input.record.evidenceText,
        confidence: clamp(input.record.confidence ?? 60),
        fingerprint,
        externalId: input.record.externalId || null,
        status: SignalStatus.ACTIVE,
        rawData: input.record.rawData as Prisma.InputJsonValue | undefined,
        occurredAt: input.record.occurredAt
          ? new Date(input.record.occurredAt)
          : new Date(),
      },
    });

    let opportunity = await prisma.opportunity.findFirst({
      where: {
        organizationId: input.organizationId,
        companyId: company.id,
        status: OpportunityStatus.OPEN,
      },
      orderBy: { updatedAt: "desc" },
    });

    const whyNow =
      input.record.whyNow || `${input.record.signalType} signal: ${input.record.title}`;
    const likelyProblem =
      input.record.likelyProblem ||
      input.record.description ||
      "Signal indicates a potential buying moment.";
    const recommendedAction =
      input.record.recommendedAction ||
      "Review signal evidence, identify decision maker, and take next outreach action.";

    const ctx = await businessBrainService.getSafeContext(input.organizationId);
    const haystack = `${input.record.title} ${input.record.description || ""}`.toLowerCase();
    const recommendedServiceId =
      ctx.services.find((s) =>
        haystack.includes(s.name.toLowerCase().split(" ")[0] || "___")
      )?.id ?? ctx.services[0]?.id ?? null;

    if (!opportunity) {
      await entitlementService.assertAndConsume(
        input.organizationId,
        FEATURE_KEYS.OPPORTUNITIES
      );
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
            ? "Associated with normalized signal"
            : null,
          estimatedValue: input.record.estimatedValue,
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
          title: "Opportunity created from signal",
          actorId: input.userId,
          metadata: {
            signalId: signal.id,
            signalType: signal.type,
            sourceKey: input.sourceKey,
          },
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
          metadata: { signalId: signal.id, signalType: signal.type },
        }
      );
    }

    await this.scoreOpportunity(input.organizationId, opportunity.id, {
      signalConfidence: signal.confidence,
      leadScore: input.record.leadScore ?? undefined,
      budgetHint: input.record.budgetHint,
    });

    await prisma.signal.update({
      where: { id: signal.id },
      data: { status: SignalStatus.CONSUMED },
    });

    return {
      skipped: false as const,
      companyId: company.id,
      contactId,
      signalId: signal.id,
      opportunityId: opportunity.id,
    };
  }

  /** @deprecated Prefer ingestNormalizedSignal via connectors */
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
    const result = await this.ingestNormalizedSignal({
      organizationId: input.organizationId,
      userId: input.userId,
      sourceKey: "job_post",
      sourceName: "Job posts",
      campaignId: input.campaignId,
      leadId: input.leadId,
      record: {
        signalType: SignalType.HIRING,
        title: input.signal.title,
        description: input.signal.description,
        evidenceUrl: input.signal.evidenceUrl,
        evidenceText: input.signal.evidenceText,
        confidence: input.signal.confidence ?? 60,
        company: {
          name: input.companyName,
          website: input.companyWebsite,
          domain: extractDomain(input.companyWebsite),
          industry: input.industry,
          country: input.country,
          description: input.companySummary,
        },
        contact: input.contact,
        whyNow: input.whyNow,
        likelyProblem: input.likelyProblem,
        recommendedAction: input.recommendedAction,
        estimatedValue: input.estimatedValue,
        leadScore: input.leadScore,
        budgetHint: input.budgetHint,
        rawData: (input.signal.rawData as Record<string, unknown>) || null,
      },
    });

    if (result.skipped) {
      return {
        companyId: result.companyId,
        contactId: result.contactId,
        signalId: result.signalId,
        opportunityId: result.opportunityId,
      };
    }

    return {
      companyId: result.companyId!,
      contactId: result.contactId,
      signalId: result.signalId!,
      opportunityId: result.opportunityId!,
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

    if (input.primaryContactId) {
      const contact = await prisma.contact.findFirst({
        where: {
          id: input.primaryContactId,
          organizationId,
          companyId: input.companyId,
        },
      });
      if (!contact) {
        throw new ValidationError(
          "Contact not found for this company in your organization"
        );
      }
    }

    const source = await this.ensureSource(organizationId, "manual", "Manual");

    await entitlementService.assertAndConsume(
      organizationId,
      FEATURE_KEYS.OPPORTUNITIES
    );

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
