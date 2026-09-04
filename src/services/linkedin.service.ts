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
import { linkedInAccountService } from "@/services/linkedin-account.service";
import { searchPeople } from "@/lib/linkedin/search";
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

  async createDiscoveryJob(
    organizationId: string,
    input: LinkedInDiscoveryInput,
    userId: string
  ) {
    return prisma.linkedInDiscoveryJob.create({
      data: {
        organizationId,
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

    const organizationId = job.organizationId;

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
              organizationId,
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
        const criteria = job.searchCriteria as LinkedInDiscoveryInput["searchCriteria"];
        let usedRealSearch = false;

        try {
          const client = await linkedInAccountService.getClient(job.createdById);
          const keywords = [
            ...(criteria?.jobTitles ?? []),
            ...(criteria?.industries ?? []),
            ...(criteria?.keywords ?? []),
          ].join(" ");

          if (keywords.trim()) {
            const results = await searchPeople(client, {
              keywords: keywords.trim(),
              count: job.targetCount,
            });
            await linkedInAccountService.incrementSearch(job.createdById);

            for (const profile of results) {
              try {
                const leadId = await this.createLeadFromLinkedInProfile(
                  organizationId,
                  {
                    firstName: profile.firstName,
                    lastName: profile.lastName,
                    fullName: profile.fullName,
                    jobTitle: profile.headline,
                    linkedInUrl: profile.linkedInUrl,
                    profileUrn: profile.profileUrn,
                    country: profile.location,
                    companyName: profile.headline?.split(" at ").pop(),
                  },
                  job.campaignId,
                  job.createdById
                );
                createdLeadIds.push(leadId);
              } catch (err) {
                errors.push(
                  `${profile.fullName}: ${err instanceof Error ? err.message : "failed"}`
                );
              }
            }
            usedRealSearch = results.length > 0;
          }
        } catch {
          // Fall back to AI-generated prospects
        }

        if (!usedRealSearch) {
          const prospects = await this.discoverProspects(
            organizationId,
            criteria,
            job.targetCount,
            job.campaign?.aiInstructions,
            job.createdById
          );

          for (const prospect of prospects) {
            try {
              const leadId = await this.createLeadFromProspect(
                organizationId,
                prospect,
                job.campaignId,
                job.createdById
              );
              createdLeadIds.push(leadId);
            } catch (err) {
              errors.push(
                `${prospect.fullName}: ${err instanceof Error ? err.message : "failed"}`
              );
            }
          }
        }
      }

      if (job.campaignId && createdLeadIds.length > 0) {
        for (const leadId of createdLeadIds) {
          automationService
            .runPipeline(organizationId, leadId, job.createdById)
            .catch(console.error);
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

  async importFromProfileUrl(
    organizationId: string,
    url: string,
    campaignId?: string | null,
    userId?: string
  ) {
    const { isValid } = this.parseProfileUrl(url);
    if (!isValid) throw new Error("Invalid LinkedIn profile URL");

    const existing = await prisma.lead.findFirst({
      where: { organizationId, linkedInUrl: url, deletedAt: null },
    });
    if (existing) return existing.id;

    const result = await aiComplete({
      feature: "linkedin_profile_enrichment",
      userId,
      organizationId,
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
      organizationId,
      { ...profile, linkedInUrl: url },
      campaignId,
      userId
    );
  }

  async discoverWithAI(
    organizationId: string,
    criteria: LinkedInDiscoveryInput["searchCriteria"],
    count: number,
    campaignId: string | null | undefined,
    userId: string,
    campaignContext?: string | null
  ) {
    const prospects = await this.discoverProspects(
      organizationId,
      criteria,
      count,
      campaignContext,
      userId
    );

    const leadIds: string[] = [];
    const errors: string[] = [];

    for (const prospect of prospects) {
      if (leadIds.length >= count) break;

      try {
        const existing = await prisma.lead.findFirst({
          where: {
            organizationId,
            deletedAt: null,
            OR: [
              ...(prospect.linkedInUrl ? [{ linkedInUrl: prospect.linkedInUrl }] : []),
              {
                fullName: prospect.fullName,
                ...(prospect.companyName ? { companyName: prospect.companyName } : {}),
              },
            ],
          },
        });
        if (existing) continue;

        const leadId = await this.createLeadFromProspect(
          organizationId,
          prospect,
          campaignId,
          userId
        );
        leadIds.push(leadId);
      } catch (err) {
        errors.push(`${prospect.fullName}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    return { leadIds, errors, prospects };
  }

  private async discoverProspects(
    organizationId: string,
    criteria: LinkedInDiscoveryInput["searchCriteria"],
    count: number,
    campaignContext?: string | null,
    userId?: string
  ): Promise<Array<ProspectProfile & { fullName: string }>> {
    const result = await aiComplete({
      feature: "linkedin_prospect_search",
      userId,
      organizationId,
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

  async createLeadFromLinkedInProfile(
    organizationId: string,
    profile: {
      firstName: string;
      lastName: string;
      fullName: string;
      jobTitle?: string;
      companyName?: string;
      linkedInUrl: string;
      profileUrn?: string;
      country?: string;
      industry?: string;
      email?: string | null;
    },
    campaignId?: string | null,
    userId?: string
  ) {
    return this.createLeadFromProspect(
      organizationId,
      {
        firstName: profile.firstName,
        lastName: profile.lastName,
        fullName: profile.fullName,
        jobTitle: profile.jobTitle ?? "",
        companyName: profile.companyName ?? "",
        linkedInUrl: profile.linkedInUrl,
        country: profile.country ?? "",
        industry: profile.industry ?? "",
        email: profile.email,
        confidence: 100,
        notes: profile.profileUrn ? `urn:${profile.profileUrn}` : undefined,
      },
      campaignId,
      userId
    );
  }

  private async createLeadFromProspect(
    organizationId: string,
    prospect: ProspectProfile & { fullName?: string },
    campaignId?: string | null,
    userId?: string
  ) {
    const fullName = prospect.fullName ?? `${prospect.firstName} ${prospect.lastName}`;

    const lead = await prisma.lead.create({
      data: {
        organizationId,
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
        automationMeta: {
          confidence: prospect.confidence,
          notes: prospect.notes,
          profileUrn: prospect.notes?.startsWith("urn:") ? prospect.notes : undefined,
        },
      },
    });

    if (campaignId) {
      await prisma.campaignLead.create({
        data: { campaignId, leadId: lead.id },
      });
    }

    await activityService.log({
      organizationId: lead.organizationId,
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
