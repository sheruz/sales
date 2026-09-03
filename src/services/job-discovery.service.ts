import prisma from "@/lib/db/prisma";
import {
  ActivityType,
  AutomationStatus,
  LeadScoreCategory,
  LeadStatus,
} from "@prisma/client";
import { aiComplete, parseAIJson } from "@/lib/ai/provider";
import { buildJobPostDiscoveryPrompt } from "@/lib/ai/prompts";
import { activityService } from "@/services/activity.service";
import { companyService } from "@/services/company.service";
import { opportunityService } from "@/services/opportunity.service";

export interface JobPostLead {
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  companyName: string;
  companyWebsite?: string | null;
  industry: string;
  country: string;
  jobPostTitle: string;
  jobPostPlatform: string;
  jobPostUrl?: string | null;
  jobRequirements: string;
  budgetHint?: string | null;
  companySummary: string;
  leadScore: number;
  scoreCategory: string;
  personalizationPoints: string[];
}

function mapScoreCategory(category: string): LeadScoreCategory {
  const map: Record<string, LeadScoreCategory> = {
    HOT: LeadScoreCategory.HOT,
    WARM: LeadScoreCategory.WARM,
    POSSIBLE: LeadScoreCategory.POSSIBLE,
    LOW_PRIORITY: LeadScoreCategory.LOW_PRIORITY,
  };
  return map[category] ?? LeadScoreCategory.POSSIBLE;
}

export class JobDiscoveryService {
  async discoverFromJobPosts(
    organizationId: string,
    criteria: {
      jobTitles?: string[];
      industries?: string[];
      countries?: string[];
      description?: string;
    },
    count: number,
    campaignId: string,
    userId: string,
    campaignContext?: string | null
  ) {
    const result = await aiComplete({
      feature: "job_post_discovery",
      userId,
      jsonMode: true,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You find B2B freelance and job-posting opportunities. Return valid JSON array only. Every lead MUST have an email.",
        },
        {
          role: "user",
          content: buildJobPostDiscoveryPrompt(
            criteria,
            count,
            campaignContext ?? undefined
          ),
        },
      ],
    });

    const prospects = parseAIJson<JobPostLead[]>(result.content);
    const leadIds: string[] = [];
    const opportunityIds: string[] = [];
    const errors: string[] = [];
    let skippedNoEmail = 0;

    for (const prospect of prospects) {
      if (leadIds.length >= count) break;

      if (!prospect.email?.includes("@")) {
        skippedNoEmail++;
        continue;
      }

      try {
        const existing = await prisma.lead.findFirst({
          where: {
            organizationId,
            deletedAt: null,
            OR: [
              { email: prospect.email.toLowerCase() },
              {
                companyName: prospect.companyName,
                fullName: `${prospect.firstName} ${prospect.lastName}`,
              },
            ],
          },
        });
        if (existing) continue;

        const created = await this.createLeadFromJobPost(
          organizationId,
          prospect,
          campaignId,
          userId
        );
        leadIds.push(created.leadId);
        if (created.opportunityId) opportunityIds.push(created.opportunityId);
      } catch (err) {
        errors.push(
          `${prospect.firstName} ${prospect.lastName}: ${err instanceof Error ? err.message : "failed"}`
        );
      }
    }

    return {
      leadIds,
      opportunityIds,
      errors,
      prospectsFound: prospects.length,
      skippedNoEmail,
    };
  }

  /**
   * Job post is a SIGNAL, not the opportunity itself.
   * Creates: Company → Contact/Lead bridge → Hiring Signal → Opportunity.
   * Legacy Lead retained for email automation / conversations.
   */
  private async createLeadFromJobPost(
    organizationId: string,
    prospect: JobPostLead,
    campaignId: string,
    userId: string
  ) {
    const fullName = `${prospect.firstName} ${prospect.lastName}`;
    const scoreCategory = mapScoreCategory(prospect.scoreCategory);

    const company = await companyService.findOrCreate(
      organizationId,
      prospect.companyName,
      {
        website: prospect.companyWebsite ?? undefined,
        industry: prospect.industry,
        country: prospect.country,
        description: prospect.companySummary,
        source: "job_post",
      }
    );

    const lead = await prisma.lead.create({
      data: {
        organizationId,
        firstName: prospect.firstName,
        lastName: prospect.lastName,
        fullName,
        email: prospect.email.toLowerCase(),
        jobTitle: prospect.jobTitle,
        companyName: prospect.companyName,
        companyWebsite: prospect.companyWebsite,
        industry: prospect.industry,
        country: prospect.country,
        companyDescription: prospect.companySummary,
        companyId: company.id,
        source: "Job Post",
        campaignId,
        createdById: userId,
        score: prospect.leadScore,
        scoreCategory,
        status: LeadStatus.QUALIFIED,
        automationStatus: AutomationStatus.IDLE,
        automationMeta: {
          jobPost: {
            jobPostTitle: prospect.jobPostTitle,
            jobPostPlatform: prospect.jobPostPlatform,
            jobPostUrl: prospect.jobPostUrl,
            jobRequirements: prospect.jobRequirements,
            budgetHint: prospect.budgetHint,
            companySummary: prospect.companySummary,
            personalizationPoints: prospect.personalizationPoints,
          },
          preResearched: true,
          opportunityEngine: true,
        },
        notes: `Hiring signal: ${prospect.jobPostTitle} (${prospect.jobPostPlatform})`,
      },
    });

    await prisma.leadResearch.create({
      data: {
        leadId: lead.id,
        companySummary: prospect.companySummary,
        whatCompanyDoes: prospect.jobRequirements,
        industry: prospect.industry,
        businessChallenges: [],
        softwareOpportunities: [prospect.jobPostTitle],
        recommendedServices: [],
        decisionMakerAnalysis: `${fullName} posted or manages hiring for: ${prospect.jobPostTitle}`,
        personalizationPoints: prospect.personalizationPoints,
        suggestedOpeningMessage: null,
        suggestedApproach: `Respond to their ${prospect.jobPostPlatform} post about ${prospect.jobPostTitle}`,
        leadScore: prospect.leadScore,
        reasoning: `Matched job post requirements: ${prospect.jobRequirements}`,
        rawResponse: prospect as object,
      },
    });

    await prisma.leadScore.create({
      data: {
        leadId: lead.id,
        score: prospect.leadScore,
        category: scoreCategory,
        explanation: prospect.jobRequirements,
        recommendedAction: "Send personalized email referencing their job post",
      },
    });

    if (campaignId) {
      await prisma.campaignLead.create({
        data: { campaignId, leadId: lead.id },
      });
    }

    const ingested = await opportunityService.ingestHiringSignal({
      organizationId,
      userId,
      campaignId,
      companyName: prospect.companyName,
      companyWebsite: prospect.companyWebsite,
      industry: prospect.industry,
      country: prospect.country,
      companySummary: prospect.companySummary,
      contact: {
        firstName: prospect.firstName,
        lastName: prospect.lastName,
        email: prospect.email,
        title: prospect.jobTitle,
      },
      signal: {
        title: prospect.jobPostTitle,
        description: prospect.jobRequirements,
        evidenceUrl: prospect.jobPostUrl,
        evidenceText: `${prospect.jobPostPlatform}: ${prospect.jobPostTitle}`,
        confidence: Math.min(95, Math.max(40, prospect.leadScore)),
        rawData: {
          platform: prospect.jobPostPlatform,
          url: prospect.jobPostUrl,
          personalizationPoints: prospect.personalizationPoints,
        },
      },
      whyNow: `Open role "${prospect.jobPostTitle}" on ${prospect.jobPostPlatform}`,
      likelyProblem: prospect.jobRequirements,
      recommendedAction: `Contact ${fullName} about ${prospect.jobPostTitle}`,
      leadScore: prospect.leadScore,
      budgetHint: prospect.budgetHint,
      leadId: lead.id,
    });

    await activityService.log({
      leadId: lead.id,
      userId,
      type: ActivityType.LEAD_CREATED,
      title: "Hiring signal → opportunity",
      description: `${fullName} — ${prospect.jobPostTitle} at ${prospect.companyName} (opportunity ${ingested.opportunityId})`,
    });

    await activityService.log({
      leadId: lead.id,
      userId,
      type: ActivityType.RESEARCH_COMPLETED,
      title: "Job post research saved",
      description: `Score: ${prospect.leadScore} (${scoreCategory})`,
    });

    return { leadId: lead.id, opportunityId: ingested.opportunityId };
  }
}

export const jobDiscoveryService = new JobDiscoveryService();
