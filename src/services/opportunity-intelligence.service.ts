import prisma from "@/lib/db/prisma";
import {
  OfferRecommendationStatus,
  OpportunityEventType,
  type Prisma,
} from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { aiComplete, parseAIJson } from "@/lib/ai/provider";
import { businessBrainService } from "@/services/business-brain.service";
import { opportunityService } from "@/services/opportunity.service";
import { offerService } from "@/services/offer.service";
import { entitlementService } from "@/services/entitlement.service";
import { FEATURE_KEYS } from "@/lib/billing/features";

interface IntelligenceAIResult {
  whyNow: string;
  likelyProblem: string;
  recommendedServiceId: string | null;
  recommendedServiceName: string | null;
  offer: {
    title: string;
    problem: string;
    solution: string;
    scope: string;
    expectedOutcome: string;
    estimatedValue: number | null;
    reasoning: string;
    relevantCaseStudyId: string | null;
  };
  decisionMaker: {
    contactId: string | null;
    reason: string;
    confidence: number;
  };
  outreachMessage: string;
  recommendedAction: string;
  summary: string;
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function titleSeniorityScore(title?: string | null): number {
  const t = (title || "").toLowerCase();
  if (/chief|ceo|cto|cfo|coo|founder|owner|president/.test(t)) return 95;
  if (/vp|vice president|head of|director/.test(t)) return 85;
  if (/manager|lead|principal/.test(t)) return 70;
  if (/engineer|developer|specialist|analyst|coordinator/.test(t)) return 45;
  return 55;
}

export class OpportunityIntelligenceService {
  /**
   * Rank contacts for outreach — title/seniority/department/company size/signal type.
   */
  rankDecisionMakers(input: {
    contacts: Array<{
      id: string;
      title: string | null;
      seniority: string | null;
      department: string | null;
      email: string | null;
      fullName: string;
    }>;
    companyEmployeeCount?: number | null;
    signalType?: string | null;
  }) {
    const ranked = input.contacts.map((c) => {
      let score = titleSeniorityScore(c.title || c.seniority);
      const dept = (c.department || "").toLowerCase();
      const signal = (input.signalType || "").toLowerCase();

      if (signal.includes("hiring") || signal.includes("tech")) {
        if (/engineering|it|product|technology/.test(dept + " " + (c.title || ""))) {
          score += 8;
        }
      }
      if (signal.includes("fund") || signal.includes("rfp")) {
        if (/ops|operations|procurement|finance|growth/.test(dept + " " + (c.title || ""))) {
          score += 8;
        }
      }
      if (c.email) score += 5;
      if ((input.companyEmployeeCount || 0) < 50 && /founder|owner|ceo/.test((c.title || "").toLowerCase())) {
        score += 5;
      }
      // historical conversion placeholder — neutral until learning phase
      const historical = 50;
      score = clamp(score * 0.85 + historical * 0.15);
      return {
        contactId: c.id,
        fullName: c.fullName,
        title: c.title,
        confidence: score,
        reason: `${c.title || "Contact"} ranked by seniority/title fit for ${input.signalType || "this opportunity"}`,
      };
    });

    ranked.sort((a, b) => b.confidence - a.confidence);
    return ranked;
  }

  async research(
    organizationId: string,
    opportunityId: string,
    userId: string,
    opts?: { force?: boolean }
  ) {
    const opportunity = await prisma.opportunity.findFirst({
      where: { id: opportunityId, organizationId },
      include: {
        company: {
          include: {
            contacts: { orderBy: { createdAt: "desc" }, take: 30 },
            signals: { orderBy: { detectedAt: "desc" }, take: 15 },
          },
        },
        primaryContact: true,
        primarySignal: true,
        intelligence: true,
        recommendedService: true,
      },
    });
    if (!opportunity) throw new NotFoundError("Opportunity not found");

    if (
      opportunity.intelligence &&
      !opts?.force &&
      opportunity.intelligenceGeneratedAt &&
      Date.now() - opportunity.intelligenceGeneratedAt.getTime() < 6 * 60 * 60 * 1000
    ) {
      return {
        cached: true,
        intelligence: opportunity.intelligence,
        score: await prisma.opportunityScore.findFirst({
          where: { opportunityId, organizationId },
          orderBy: { createdAt: "desc" },
        }),
      };
    }

    await entitlementService.assertFeature(
      organizationId,
      FEATURE_KEYS.ADVANCED_AI
    );
    await entitlementService.assertAndConsume(
      organizationId,
      FEATURE_KEYS.ENRICHMENT
    );

    const brain = await businessBrainService.getSafeContext(organizationId);
    if (!brain.services.length) {
      throw new ValidationError(
        "Configure at least one service in Business Brain before generating intelligence"
      );
    }

    const [caseStudies, offers, wonCount, lostCount] = await Promise.all([
      prisma.serviceCaseStudy.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.offer.findMany({
        where: { organizationId, status: "ACTIVE" },
        include: { service: { select: { id: true, name: true } } },
        take: 50,
      }),
      prisma.opportunity.count({
        where: { organizationId, status: "WON" },
      }),
      prisma.opportunity.count({
        where: { organizationId, status: "LOST" },
      }),
    ]);

    const contacts =
      opportunity.company.contacts.length > 0
        ? opportunity.company.contacts
        : opportunity.primaryContact
          ? [opportunity.primaryContact]
          : [];

    const rankedContacts = this.rankDecisionMakers({
      contacts,
      companyEmployeeCount: opportunity.company.employeeCount,
      signalType: opportunity.primarySignal?.type,
    });

    // Explainable score first (rules) — AI may refine narrative later
    const scoreRow = await opportunityService.scoreOpportunity(
      organizationId,
      opportunityId,
      {
        signalConfidence: opportunity.primarySignal?.confidence,
        budgetHint: opportunity.estimatedValue ? "present" : null,
      }
    );

    const scoreBreakdown = {
      icpFit: scoreRow.icpFit,
      signalStrength: scoreRow.signalStrength,
      urgency: scoreRow.urgency,
      serviceFit: scoreRow.serviceFit,
      reachability: scoreRow.reachability,
      freshness: scoreRow.freshness,
      budgetPotential: scoreRow.budgetPotential,
      growth: scoreRow.growth,
      historicalConversion: scoreRow.historicalConversion,
      overall: scoreRow.totalScore,
      explanation: scoreRow.explanation,
    };

    const allowedServiceIds = brain.services.map((s) => s.id);
    const allowedOfferIds = offers.map((o) => o.id);

    const result = await aiComplete({
      feature: "opportunity_intelligence",
      operation: "opportunity_intelligence",
      organizationId,
      userId,
      jsonMode: true,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You are a B2B sales intelligence assistant for a Revenue OS.
Return ONLY valid JSON with this shape:
{
  "whyNow": string,
  "likelyProblem": string,
  "recommendedServiceId": string|null,
  "recommendedServiceName": string|null,
  "offer": {
    "title": string,
    "problem": string,
    "solution": string,
    "scope": string,
    "expectedOutcome": string,
    "estimatedValue": number|null,
    "reasoning": string,
    "relevantCaseStudyId": string|null
  },
  "decisionMaker": {
    "contactId": string|null,
    "reason": string,
    "confidence": number
  },
  "outreachMessage": string,
  "recommendedAction": string,
  "summary": string
}
Rules:
- whyNow must cite signal evidence.
- recommendedServiceId MUST be one of the provided service IDs — never invent a service.
- relevantCaseStudyId must be from provided case studies or null.
- decisionMaker.contactId must be from provided contacts or null.
- Be concise. No private chain-of-thought. No API keys.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            businessProfile: brain.profile,
            revenueGoals: brain.activeGoals,
            icps: brain.icps,
            services: brain.services,
            caseStudies: caseStudies.map((c) => ({
              id: c.id,
              serviceId: c.serviceId,
              title: c.title,
              customerIndustry: c.customerIndustry,
              problem: c.problem,
              outcome: c.outcome,
            })),
            existingOffers: offers.map((o) => ({
              id: o.id,
              serviceId: o.serviceId,
              name: o.name,
              problem: o.problem,
              solution: o.solution,
            })),
            company: {
              id: opportunity.company.id,
              name: opportunity.company.name,
              domain: opportunity.company.domain,
              industry: opportunity.company.industry,
              country: opportunity.company.country,
              employeeCount: opportunity.company.employeeCount,
              description: opportunity.company.description,
              technologies: opportunity.company.technologies,
            },
            signals: opportunity.company.signals.map((s) => ({
              type: s.type,
              title: s.title,
              description: s.description,
              confidence: s.confidence,
              evidenceUrl: s.evidenceUrl,
              detectedAt: s.detectedAt,
            })),
            opportunity: {
              id: opportunity.id,
              stage: opportunity.stage,
              whyNow: opportunity.whyNow,
              likelyProblem: opportunity.likelyProblem,
              score: scoreBreakdown,
            },
            rankedContacts,
            historicalLearning: {
              wonCount,
              lostCount,
              note: "Use only as soft prior; do not fabricate conversion rates",
            },
            allowedServiceIds,
            allowedOfferIds,
          }),
        },
      ],
    });

    const data = parseAIJson<IntelligenceAIResult>(result.content);

    // Enforce service whitelist
    let serviceId = data.recommendedServiceId;
    if (!serviceId || !allowedServiceIds.includes(serviceId)) {
      const byName = brain.services.find(
        (s) =>
          s.name.toLowerCase() ===
          (data.recommendedServiceName || "").toLowerCase()
      );
      serviceId = byName?.id ?? brain.services[0].id;
    }
    const service = brain.services.find((s) => s.id === serviceId)!;

    let caseStudyId = data.offer?.relevantCaseStudyId || null;
    if (
      caseStudyId &&
      !caseStudies.some((c) => c.id === caseStudyId && c.serviceId === serviceId)
    ) {
      caseStudyId =
        caseStudies.find((c) => c.serviceId === serviceId)?.id ?? null;
    }

    const offerDraft = data.offer || {
      title: `${service.name} engagement`,
      problem: data.likelyProblem,
      solution: service.description,
      scope: "Discovery + delivery scoped to stated problem",
      expectedOutcome: "Measurable progress on the indicated problem",
      estimatedValue: null,
      reasoning: "Matched configured service to signal-indicated need",
      relevantCaseStudyId: caseStudyId,
    };

    const offer = await offerService.ensureOfferForService(organizationId, serviceId, {
      name: offerDraft.title.slice(0, 200),
      problem: offerDraft.problem,
      solution: offerDraft.solution,
      outcome: offerDraft.expectedOutcome,
      description: offerDraft.scope,
      minValue: offerDraft.estimatedValue,
      maxValue: offerDraft.estimatedValue,
    });

    let contactId = data.decisionMaker?.contactId || null;
    if (contactId && !contacts.some((c) => c.id === contactId)) {
      contactId = rankedContacts[0]?.contactId ?? null;
    }
    if (!contactId) contactId = rankedContacts[0]?.contactId ?? opportunity.primaryContactId;
    const contactReason =
      data.decisionMaker?.reason ||
      rankedContacts[0]?.reason ||
      "Best available contact for this opportunity";
    const contactConfidence = clamp(
      data.decisionMaker?.confidence ?? rankedContacts[0]?.confidence ?? 50
    );

    await prisma.opportunityOfferRecommendation.updateMany({
      where: { opportunityId, organizationId, status: OfferRecommendationStatus.SUGGESTED },
      data: { status: OfferRecommendationStatus.SUPERSEDED },
    });

    await prisma.opportunityOfferRecommendation.create({
      data: {
        organizationId,
        opportunityId,
        offerId: offer.id,
        confidence: clamp(scoreRow.serviceFit),
        fitReason: offerDraft.reasoning,
        expectedValue: offerDraft.estimatedValue,
        explanation: offerDraft.scope,
        status: OfferRecommendationStatus.SUGGESTED,
      },
    });

    const intelligence = await prisma.opportunityIntelligence.upsert({
      where: { opportunityId },
      create: {
        organizationId,
        opportunityId,
        whyNow: data.whyNow || opportunity.whyNow || "Signal indicates buying momentum",
        likelyProblem:
          data.likelyProblem ||
          opportunity.likelyProblem ||
          "Business need indicated by recent signals",
        recommendedServiceId: serviceId,
        recommendedOfferId: offer.id,
        recommendedContactId: contactId,
        recommendedContactReason: contactReason,
        recommendedContactConfidence: contactConfidence,
        outreachMessage: data.outreachMessage,
        recommendedAction: data.recommendedAction,
        offerTitle: offerDraft.title,
        offerProblem: offerDraft.problem,
        offerSolution: offerDraft.solution,
        offerScope: offerDraft.scope,
        offerExpectedOutcome: offerDraft.expectedOutcome,
        offerEstimatedValue: offerDraft.estimatedValue,
        offerReasoning: offerDraft.reasoning,
        relevantCaseStudyId: caseStudyId,
        scoreBreakdown: scoreBreakdown as Prisma.InputJsonValue,
        summary: data.summary,
        model: result.model,
        generatedAt: new Date(),
      },
      update: {
        whyNow: data.whyNow || opportunity.whyNow || "Signal indicates buying momentum",
        likelyProblem:
          data.likelyProblem ||
          opportunity.likelyProblem ||
          "Business need indicated by recent signals",
        recommendedServiceId: serviceId,
        recommendedOfferId: offer.id,
        recommendedContactId: contactId,
        recommendedContactReason: contactReason,
        recommendedContactConfidence: contactConfidence,
        outreachMessage: data.outreachMessage,
        recommendedAction: data.recommendedAction,
        offerTitle: offerDraft.title,
        offerProblem: offerDraft.problem,
        offerSolution: offerDraft.solution,
        offerScope: offerDraft.scope,
        offerExpectedOutcome: offerDraft.expectedOutcome,
        offerEstimatedValue: offerDraft.estimatedValue,
        offerReasoning: offerDraft.reasoning,
        relevantCaseStudyId: caseStudyId,
        scoreBreakdown: scoreBreakdown as Prisma.InputJsonValue,
        summary: data.summary,
        model: result.model,
        generatedAt: new Date(),
      },
    });

    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        whyNow: intelligence.whyNow,
        likelyProblem: intelligence.likelyProblem,
        recommendedServiceId: serviceId,
        recommendedOfferId: offer.id,
        recommendedContactId: contactId,
        recommendedContactReason: contactReason,
        recommendedContactConfidence: contactConfidence,
        outreachMessage: data.outreachMessage,
        recommendedAction: data.recommendedAction,
        estimatedValue: offerDraft.estimatedValue ?? undefined,
        intelligenceGeneratedAt: new Date(),
        primaryContactId: contactId ?? opportunity.primaryContactId,
      },
    });

    await opportunityService.addEvent(
      organizationId,
      opportunityId,
      OpportunityEventType.RESEARCHED,
      {
        title: "AI opportunity intelligence generated",
        actorId: userId,
        metadata: {
          serviceId,
          offerId: offer.id,
          contactId,
          score: scoreRow.totalScore,
        },
      }
    );

    return {
      cached: false,
      intelligence,
      score: scoreRow,
      rankedContacts,
      offer,
    };
  }
}

export const opportunityIntelligenceService =
  new OpportunityIntelligenceService();
