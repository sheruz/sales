import prisma from "@/lib/db/prisma";
import {
  AiRecommendationPriority,
  AiRecommendationStatus,
  AiRecommendationType,
  OpportunityStage,
  OpportunityStatus,
} from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { aiComplete, parseAIJson } from "@/lib/ai/provider";
import { analyticsService } from "@/services/analytics.service";
import { learningService } from "@/services/learning.service";

type DailyPlanItem = {
  type: string;
  entityType?: string;
  entityId?: string;
  title: string;
  description?: string;
  reason: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  expectedImpact: string;
  action: string;
};

export class AiRecommendationService {
  async listToday(organizationId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return prisma.aiRecommendation.findMany({
      where: {
        organizationId,
        status: {
          in: [
            AiRecommendationStatus.PENDING,
            AiRecommendationStatus.ACCEPTED,
          ],
        },
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
        createdAt: { gte: start },
      },
      orderBy: [{ priority: "desc" }, { confidence: "desc" }],
      take: 30,
    });
  }

  async list(organizationId: string, status?: AiRecommendationStatus) {
    return prisma.aiRecommendation.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: AiRecommendationStatus
  ) {
    const existing = await prisma.aiRecommendation.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundError("Recommendation not found");
    return prisma.aiRecommendation.update({
      where: { id },
      data: {
        status,
        resolvedAt:
          status === AiRecommendationStatus.PENDING ? null : new Date(),
      },
    });
  }

  /**
   * Generate today's revenue priorities. Uses rules + optional AI enrichment.
   * Never auto-mutates strategy — recommendations only.
   */
  async generateDailyPlan(organizationId: string, userId?: string) {
    const [dashboard, learning, opportunities] = await Promise.all([
      analyticsService.getRevenueDashboard(organizationId),
      learningService.discoverPatterns(organizationId),
      prisma.opportunity.findMany({
        where: {
          organizationId,
          status: OpportunityStatus.OPEN,
          stage: { notIn: [OpportunityStage.WON, OpportunityStage.LOST] },
        },
        include: {
          company: { select: { id: true, name: true, industry: true } },
          primaryContact: { select: { fullName: true, title: true, email: true } },
          intelligence: true,
          primarySignal: { select: { type: true, title: true } },
        },
        orderBy: [{ score: "desc" }, { estimatedValue: "desc" }],
        take: 40,
      }),
    ]);

    const expiresAt = new Date();
    expiresAt.setHours(23, 59, 59, 999);

    // Expire prior pending daily priorities from earlier today/yesterday
    await prisma.aiRecommendation.updateMany({
      where: {
        organizationId,
        type: {
          in: [
            AiRecommendationType.DAILY_PRIORITY,
            AiRecommendationType.FOLLOW_UP,
            AiRecommendationType.OUTREACH,
            AiRecommendationType.STOP_PURSUING,
            AiRecommendationType.LEARNING_INSIGHT,
          ],
        },
        status: AiRecommendationStatus.PENDING,
      },
      data: { status: AiRecommendationStatus.EXPIRED },
    });

    const items: DailyPlanItem[] = [];

    const gap = dashboard.revenueTarget - dashboard.revenueAchieved;
    if (dashboard.revenueTarget > 0 && gap > 0) {
      items.push({
        type: "DAILY_PRIORITY",
        title: `Close ${dashboard.currency} ${Math.round(gap).toLocaleString()} gap to target`,
        reason: `Revenue achieved ${dashboard.revenueAchieved} of ${dashboard.revenueTarget} (${dashboard.revenueProgress ?? 0}%).`,
        priority: gap > dashboard.revenueTarget * 0.5 ? "CRITICAL" : "HIGH",
        confidence: 80,
        expectedImpact: `Progress toward hitting ${dashboard.goalName ?? "revenue target"}`,
        action: "Focus outreach and proposals on highest weighted pipeline deals today",
      });
    }

    const hot = opportunities.filter((o) => o.score >= 75).slice(0, 3);
    if (hot.length) {
      items.push({
        type: "FOLLOW_UP",
        entityType: "opportunity",
        entityId: hot[0].id,
        title: `Follow up with ${hot.length} high-value opportunities`,
        description: hot.map((o) => o.company.name).join(", "),
        reason: `Top scored open opportunities (scores ${hot.map((o) => o.score).join(", ")}).`,
        priority: "HIGH",
        confidence: 85,
        expectedImpact: "Increase reply and meeting conversion on best-fit accounts",
        action: `Contact ${hot.map((o) => o.company.name).join("; ")} today`,
      });
    }

    const funded = opportunities
      .filter((o) => o.primarySignal?.type === "FUNDING")
      .slice(0, 2);
    if (funded.length) {
      items.push({
        type: "OUTREACH",
        entityType: "opportunity",
        entityId: funded[0].id,
        title: `Contact ${funded.length} newly funded companies`,
        description: funded.map((o) => o.company.name).join(", "),
        reason: "Funding signals often correlate with higher buying urgency.",
        priority: "HIGH",
        confidence: 75,
        expectedImpact: "Capture budget while post-funding momentum is high",
        action: `Send tailored outreach to ${funded.map((o) => o.company.name).join(" and ")}`,
      });
    }

    const needsProposal = opportunities.filter(
      (o) =>
        o.stage === OpportunityStage.MEETING ||
        o.stage === OpportunityStage.PROPOSAL
    );
    if (needsProposal[0]) {
      items.push({
        type: "PROPOSAL",
        entityType: "opportunity",
        entityId: needsProposal[0].id,
        title: `Prepare proposal for ${needsProposal[0].company.name}`,
        reason: `Stage is ${needsProposal[0].stage}; moving to a written offer increases close probability.`,
        priority: "HIGH",
        confidence: 78,
        expectedImpact: "Advance deal into negotiation with clear scope and value",
        action: `Draft and send proposal for ${needsProposal[0].company.name}`,
      });
    }

    const callTarget = opportunities.find(
      (o) =>
        o.stage === OpportunityStage.REPLIED &&
        o.primaryContact?.email
    );
    if (callTarget) {
      items.push({
        type: "MEETING",
        entityType: "opportunity",
        entityId: callTarget.id,
        title: `Call ${callTarget.company.name}`,
        reason: "Positive reply stage — convert conversation into a meeting.",
        priority: "MEDIUM",
        confidence: 70,
        expectedImpact: "Book discovery meeting and lock next step",
        action: `Schedule a call with ${callTarget.primaryContact?.fullName ?? "the contact"}`,
      });
    }

    const lowIntent = opportunities.filter(
      (o) => o.score < 35 && o.stage === OpportunityStage.CONTACTED
    );
    if (lowIntent[0]) {
      items.push({
        type: "STOP_PURSUING",
        entityType: "opportunity",
        entityId: lowIntent[0].id,
        title: `Stop pursuing ${lowIntent[0].company.name} due to low intent`,
        reason: `Score ${lowIntent[0].score}/100 with no meaningful progression past contacted.`,
        priority: "MEDIUM",
        confidence: 65,
        expectedImpact: "Free capacity for higher-probability pipeline",
        action: `Mark ${lowIntent[0].company.name} as low priority or lost`,
      });
    }

    for (const insight of learning.insights.slice(0, 3)) {
      items.push({
        type: "LEARNING_INSIGHT",
        title: insight.pattern.slice(0, 180),
        description: insight.recommendation,
        reason: insight.pattern,
        priority: insight.lift >= 2 ? "HIGH" : "MEDIUM",
        confidence: insight.confidence,
        expectedImpact: `Apply pattern with ${insight.lift}x historical lift (approval required)`,
        action: insight.recommendation,
      });
    }

    // Optional AI enrichment when opportunities exist
    if (opportunities.length > 0 && userId) {
      try {
        const ai = await aiComplete({
          feature: "daily_revenue_copilot",
          operation: "daily_revenue_plan",
          organizationId,
          userId,
          jsonMode: true,
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content: `You are a B2B revenue copilot. Return JSON: { "items": [{ "title", "reason", "priority": "HIGH"|"MEDIUM"|"LOW", "expectedImpact", "action", "entityId"? }] }.
Max 3 items. Be specific. Never invent companies not in the list. Never change strategy automatically.`,
            },
            {
              role: "user",
              content: JSON.stringify({
                revenue: {
                  target: dashboard.revenueTarget,
                  achieved: dashboard.revenueAchieved,
                  gap,
                },
                topOpportunities: opportunities.slice(0, 12).map((o) => ({
                  id: o.id,
                  company: o.company.name,
                  stage: o.stage,
                  score: o.score,
                  signal: o.primarySignal?.type,
                  next: o.intelligence?.recommendedAction,
                })),
                learning: learning.insights.slice(0, 5),
              }),
            },
          ],
        });
        const parsed = parseAIJson<{ items: DailyPlanItem[] }>(ai.content);
        for (const item of parsed.items ?? []) {
          if (!item.title || !item.reason || !item.action) continue;
          items.push({
            type: "DAILY_PRIORITY",
            entityType: item.entityId ? "opportunity" : undefined,
            entityId: item.entityId,
            title: item.title.slice(0, 200),
            reason: item.reason.slice(0, 1000),
            priority: (item.priority as DailyPlanItem["priority"]) || "MEDIUM",
            confidence: Math.min(95, item.confidence || 70),
            expectedImpact: item.expectedImpact || "Improve chance of hitting revenue target",
            action: item.action.slice(0, 1000),
          });
        }
      } catch {
        // Rules-based plan is enough
      }
    }

    if (items.length === 0) {
      throw new ValidationError(
        "Not enough pipeline data to build a daily plan. Add opportunities and an active revenue goal."
      );
    }

    const created = [];
    for (const item of items.slice(0, 12)) {
      const row = await prisma.aiRecommendation.create({
        data: {
          organizationId,
          type: (Object.values(AiRecommendationType).includes(
            item.type as AiRecommendationType
          )
            ? item.type
            : AiRecommendationType.DAILY_PRIORITY) as AiRecommendationType,
          entityType: item.entityType,
          entityId: item.entityId,
          title: item.title,
          description: item.description,
          reason: item.reason,
          priority: item.priority as AiRecommendationPriority,
          confidence: item.confidence,
          expectedImpact: item.expectedImpact,
          action: item.action,
          status: AiRecommendationStatus.PENDING,
          expiresAt,
        },
      });
      created.push(row);
    }

    return {
      generatedAt: new Date().toISOString(),
      revenueContext: {
        target: dashboard.revenueTarget,
        achieved: dashboard.revenueAchieved,
        gap,
        currency: dashboard.currency,
      },
      recommendations: created,
    };
  }
}

export const aiRecommendationService = new AiRecommendationService();
