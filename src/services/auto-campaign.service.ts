import prisma from "@/lib/db/prisma";
import { aiComplete, parseAIJson } from "@/lib/ai/provider";
import { campaignService } from "@/services/campaign.service";

interface AICampaignPlan {
  name: string;
  description: string;
  targetAudience: string;
  targetJobTitles: string[];
  targetIndustries: string[];
  targetCountries: string[];
  searchKeywords: string;
  aiInstructions: string;
  serviceName?: string;
}

export class AutoCampaignService {
  async createFromGoal(
    organizationId: string,
    goal: string,
    userId: string,
    serviceId?: string
  ) {
    const services = await prisma.service.findMany({
      where: { organizationId, isActive: true },
    });

    const result = await aiComplete({
      feature: "auto_campaign",
      userId,
      organizationId,
      jsonMode: true,
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: "You are a B2B sales strategist. Create campaign plans. JSON only.",
        },
        {
          role: "user",
          content: `Create a LinkedIn outreach campaign plan for this goal:

GOAL: ${goal}

OUR SERVICES:
${services.map((s) => `- ${s.name}: ${s.description}`).join("\n")}

Return JSON:
{
  "name": "campaign name",
  "description": "what this campaign does",
  "targetAudience": "who we target",
  "targetJobTitles": ["title1", "title2"],
  "targetIndustries": ["industry1"],
  "targetCountries": ["country1"],
  "searchKeywords": "LinkedIn search keywords combined",
  "aiInstructions": "messaging tone and rules for AI outreach",
  "serviceName": "best matching service name from list"
}`,
        },
      ],
    });

    const plan = parseAIJson<AICampaignPlan>(result.content);

    let resolvedServiceId = serviceId;
    if (!resolvedServiceId && plan.serviceName) {
      const match = services.find(
        (s) => s.name.toLowerCase() === plan.serviceName?.toLowerCase()
      );
      resolvedServiceId = match?.id;
    }

    const campaign = await campaignService.create(organizationId, {
      name: plan.name,
      description: plan.description,
      targetAudience: plan.targetAudience,
      targetCountries: plan.targetCountries,
      targetIndustries: plan.targetIndustries,
      serviceId: resolvedServiceId,
      aiInstructions: plan.aiInstructions,
      dailyOutreachLimit: 50,
      status: "ACTIVE",
    });

    return { campaign, plan };
  }

  buildSearchKeywords(criteria: {
    targetJobTitles?: string[];
    targetIndustries?: string[];
    targetCountries?: string[];
    goal?: string;
  }): string {
    const parts = [
      ...(criteria.targetJobTitles ?? []),
      ...(criteria.targetIndustries ?? []),
    ];
    if (criteria.goal) parts.push(criteria.goal.split(" ").slice(0, 5).join(" "));
    return parts.join(" ").trim() || "CEO founder";
  }
}

export const autoCampaignService = new AutoCampaignService();
