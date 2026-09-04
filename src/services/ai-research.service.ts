import prisma from "@/lib/db/prisma";
import {
  ActivityType,
  AutomationStatus,
  LeadScoreCategory,
  LeadStatus,
} from "@prisma/client";
import { NotFoundError } from "@/lib/api/response";
import { aiComplete, parseAIJson } from "@/lib/ai/provider";
import { buildResearchPrompt } from "@/lib/ai/prompts";
import { activityService } from "@/services/activity.service";

interface ResearchResult {
  companySummary: string;
  whatCompanyDoes: string;
  industry: string;
  businessChallenges: string[];
  softwareOpportunities: string[];
  recommendedServices: string[];
  decisionMakerAnalysis: string;
  personalizationPoints: string[];
  suggestedOpeningMessage: string;
  suggestedApproach: string;
  leadScore: number;
  reasoning: string;
  scoreCategory: string;
  recommendedAction: string;
}

export class AIResearchService {
  /**
   * Research a lead within an organization. organizationId is required and
   * must match the lead — never trust leadId alone.
   */
  async researchLead(
    organizationId: string,
    leadId: string,
    userId?: string
  ) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
      include: { campaign: true },
    });
    if (!lead) throw new NotFoundError("Lead not found");

    const services = await prisma.service.findMany({
      where: { organizationId, isActive: true },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        automationStatus: AutomationStatus.RESEARCHING,
        status: LeadStatus.RESEARCHING,
      },
    });

    const result = await aiComplete({
      feature: "lead_research",
      userId,
      organizationId,
      jsonMode: true,
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content:
            "You are a B2B sales research analyst. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: buildResearchPrompt(
            lead,
            services,
            lead.campaign?.aiInstructions
          ),
        },
      ],
    });

    const data = parseAIJson<ResearchResult>(result.content);
    const scoreCategory = this.mapScoreCategory(data.scoreCategory);

    const research = await prisma.leadResearch.create({
      data: {
        leadId,
        companySummary: data.companySummary,
        whatCompanyDoes: data.whatCompanyDoes,
        industry: data.industry,
        businessChallenges: data.businessChallenges,
        softwareOpportunities: data.softwareOpportunities,
        recommendedServices: data.recommendedServices,
        decisionMakerAnalysis: data.decisionMakerAnalysis,
        personalizationPoints: data.personalizationPoints,
        suggestedOpeningMessage: data.suggestedOpeningMessage,
        suggestedApproach: data.suggestedApproach,
        leadScore: data.leadScore,
        reasoning: data.reasoning,
        rawResponse: data as object,
      },
    });

    await prisma.leadScore.create({
      data: {
        leadId,
        score: data.leadScore,
        category: scoreCategory,
        explanation: data.reasoning,
        recommendedAction: data.recommendedAction,
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        score: data.leadScore,
        scoreCategory,
        industry: data.industry || lead.industry,
        automationStatus: AutomationStatus.SCORING,
      },
    });

    await activityService.log({
      organizationId,
      leadId,
      userId,
      type: ActivityType.RESEARCH_COMPLETED,
      title: "AI research completed",
      description: `Score: ${data.leadScore} (${scoreCategory})`,
    });

    await activityService.log({
      organizationId,
      leadId,
      userId,
      type: ActivityType.SCORE_UPDATED,
      title: "Lead scored by AI",
      description: data.reasoning,
    });

    return { research, score: data.leadScore, category: scoreCategory };
  }

  private mapScoreCategory(category: string): LeadScoreCategory {
    const map: Record<string, LeadScoreCategory> = {
      HOT: LeadScoreCategory.HOT,
      WARM: LeadScoreCategory.WARM,
      POSSIBLE: LeadScoreCategory.POSSIBLE,
      LOW_PRIORITY: LeadScoreCategory.LOW_PRIORITY,
    };
    return map[category?.toUpperCase()] ?? LeadScoreCategory.POSSIBLE;
  }
}

export const aiResearchService = new AIResearchService();
