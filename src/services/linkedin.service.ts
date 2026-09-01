import prisma from "@/lib/db/prisma";
import { ActivityType, AutomationStatus, JobStatus } from "@prisma/client";
import { NotFoundError } from "@/lib/api/response";
import { aiComplete, parseAIJson } from "@/lib/ai/provider";
import {
  buildLinkedInProspectPrompt,
  buildProspectSearchPrompt,
} from "@/lib/ai/prompts";
import { LINKEDIN_PROFILE_URL_REGEX } from "@/lib/constants/automation";
import { activityService } from "@/services/activity.service";
import { automationService } from "@/services/automation.service";
import type { LinkedInDiscoveryInput } from "@/lib/validations/automation";

interface ProspectProfile {
  firstName: string;
  lastName: string;
  jobTitle: string;
  companyName: string;
  companyWebsite?: string | null;
  industry: string;
  country: string;
  city?: string | null;
  companySize?: string;
  companyDescription?: string;
  email?: string | null;
  linkedInUrl?: string;
  confidence: number;
  notes?: string;
}

export class LinkedInService {
  parseProfileUrl(url: string): { isValid: boolean; slug: string } {
    const trimmed = url.trim();
    const isValid = LINKEDIN_PROFILE_URL_REGEX.test(trimmed);
    const slug = trimmed.split("/in/")[1]?.replace(/\/$/, "") ?? "";
    return { isValid, slug };
  }

  async createDiscoveryJob(input: LinkedInDiscoveryInput, userId: string) {
    return prisma.linkedInDiscoveryJob.create({
      data: {
        campaignId: input.campaignId,
        createdById: userId,
        profileUrls: input.profileUrls ?? [],
        searchCriteria: input.searchCriteria ?? {},
        targetCount: input.targetCount,
        status: JobStatus.PENDING,
      },
    });
  }

  async processDiscoveryJob(jobId: string) {
    const job = await prisma.linkedInDiscoveryJob.findUnique({
      where: { id: jobId },
      include: { campaign: true },
    });
    if (!job) throw new NotFoundError("Discovery job not found");

    await prisma.linkedInDiscoveryJob.update({
      where: { id: jobId },
      data: { status: JobStatus.PROCESSING },
    });

    const createdLeadIds: string[] = [];
    const errors: string[] = [];

    try {
      if (job.profileUrls.length > 0) {
        for (const url of job.profileUrls) {
          try {
            const leadId = await this.importFromProfileUrl(
              url,
              job.campaignId,
              job.createdById
            );
            createdLeadIds.push(leadId);
          } catch (err) {
            errors.push(`${url}: ${err instanceof Error ? err.message : "failed"}`);
          }
        }
      } else if (job.searchCriteria) {
        const prospects = await this.discoverProspects(
          job.searchCriteria as LinkedInDiscoveryInput["searchCriteria"],
          job.targetCount,
          job.campaign?.aiInstructions,
          job.createdById
        );

        for (const prospect of prospects) {
          try {
            const leadId = await this.createLeadFromProspect(
              prospect,
              job.campaignId,
              job.createdById
            );
            createdLeadIds.push(leadId);
          } catch (err) {
            errors.push(`${prospect.fullName}: ${err instanceof Error ? err.message : "failed"}`);
          }
        }
      }

      if (job.campaignId) {
        const autoStart = true;
        if (autoStart && createdLeadIds.length > 0) {
          await automationService.startBatch(
            createdLeadIds,
            job.campaignId,
            job.createdById,
            ["linkedin", "email"]
          );
        }
      }

      await prisma.linkedInDiscoveryJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.COMPLETED,
          leadsCreated: createdLeadIds.length,
          results: { leadIds: createdLeadIds, errors },
          completedAt: new Date(),
        },
      });

      return { leadIds: createdLeadIds, errors };
    } catch (err) {
      await prisma.linkedInDiscoveryJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.FAILED,
          error: err instanceof Error ? err.message : "Discovery failed",
        },
      });
      throw err;
    }
  }

  async importFromProfileUrl(url: string, campaignId?: string | null, userId?: string) {
    const { isValid } = this.parseProfileUrl(url);
    if (!isValid) throw new Error("Invalid LinkedIn profile URL");

    const existing = await prisma.lead.findFirst({
      where: { linkedInUrl: url, deletedAt: null },
    });
    if (existing) return existing.id;

    const result = await aiComplete({
      feature: "linkedin_profile_enrichment",
      userId,
      jsonMode: true,
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: "Generate realistic B2B prospect data from LinkedIn URL. JSON only.",
        },
        { role: "user", content: buildLinkedInProspectPrompt(url) },
      ],
    });

    const profile = parseAIJson<ProspectProfile>(result.content);
    return this.createLeadFromProspect(
      { ...profile, linkedInUrl: url },
      campaignId,
      userId
    );
  }

  private async discoverProspects(
    criteria: LinkedInDiscoveryInput["searchCriteria"],
    count: number,
    campaignContext?: string | null,
    userId?: string
  ): Promise<Array<ProspectProfile & { fullName: string }>> {
    const result = await aiComplete({
      feature: "linkedin_prospect_search",
      userId,
      jsonMode: true,
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: "Generate realistic B2B prospect profiles for LinkedIn outreach. JSON array only.",
        },
        {
          role: "user",
          content: buildProspectSearchPrompt(criteria ?? {}, count, campaignContext ?? undefined),
        },
      ],
    });

    const prospects = parseAIJson<Array<ProspectProfile>>(result.content);
    return prospects.map((p) => ({
      ...p,
      fullName: `${p.firstName} ${p.lastName}`,
    }));
  }

  private async createLeadFromProspect(
    prospect: ProspectProfile & { fullName?: string },
    campaignId?: string | null,
    userId?: string
  ) {
    const fullName = prospect.fullName ?? `${prospect.firstName} ${prospect.lastName}`;

    const lead = await prisma.lead.create({
      data: {
        firstName: prospect.firstName,
        lastName: prospect.lastName,
        fullName,
        email: prospect.email,
        jobTitle: prospect.jobTitle,
        companyName: prospect.companyName,
        companyWebsite: prospect.companyWebsite,
        industry: prospect.industry,
        country: prospect.country,
        city: prospect.city,
        companySize: prospect.companySize,
        companyDescription: prospect.companyDescription,
        linkedInUrl: prospect.linkedInUrl,
        source: "LinkedIn",
        campaignId,
        createdById: userId,
        automationStatus: AutomationStatus.DISCOVERING,
        automationMeta: { confidence: prospect.confidence, notes: prospect.notes },
      },
    });

    if (campaignId) {
      await prisma.campaignLead.create({
        data: { campaignId, leadId: lead.id },
      });
    }

    await activityService.log({
      leadId: lead.id,
      userId,
      type: ActivityType.LEAD_CREATED,
      title: "Lead discovered from LinkedIn",
      description: `${fullName} — ${prospect.jobTitle} at ${prospect.companyName}`,
    });

    return lead.id;
  }
}

export const linkedInService = new LinkedInService();
