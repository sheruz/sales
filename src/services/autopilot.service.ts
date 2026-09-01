import prisma from "@/lib/db/prisma";
import { CampaignStatus, JobStatus } from "@prisma/client";
import { linkedInAccountService } from "@/services/linkedin-account.service";
import { autoCampaignService } from "@/services/auto-campaign.service";
import { linkedInService } from "@/services/linkedin.service";
import { automationService } from "@/services/automation.service";
import { searchPeople } from "@/lib/linkedin/search";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import type { Prisma } from "@prisma/client";

export class AutopilotService {
  async getOrCreateConfig(userId: string) {
    return prisma.autopilotConfig.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: {
        service: { select: { id: true, name: true } },
        activeCampaign: { select: { id: true, name: true, status: true } },
      },
    });
  }

  async updateConfig(
    userId: string,
    data: {
      isEnabled?: boolean;
      goal?: string;
      targetJobTitles?: string[];
      targetIndustries?: string[];
      targetCountries?: string[];
      dailySearchLimit?: number;
      dailyMessageLimit?: number;
      autoCreateCampaigns?: boolean;
      serviceId?: string;
    }
  ) {
    await this.getOrCreateConfig(userId);
    return prisma.autopilotConfig.update({
      where: { userId },
      data,
      include: {
        service: { select: { id: true, name: true } },
        activeCampaign: { select: { id: true, name: true } },
      },
    });
  }

  async run(userId: string) {
    const config = await this.getOrCreateConfig(userId);

    if (!config.isEnabled) {
      throw new ValidationError("Autopilot is not enabled");
    }

    if (!config.goal) {
      throw new ValidationError("Set an autopilot goal first");
    }

    const canSearch = await linkedInAccountService.canSearch(
      userId,
      config.dailySearchLimit
    );
    if (!canSearch) {
      throw new ValidationError("Daily LinkedIn search limit reached");
    }

    const log: string[] = [];
    let campaignId = config.activeCampaignId;

    // Step 1: Auto-create campaign if needed
    if (!campaignId && config.autoCreateCampaigns) {
      log.push("Creating campaign from AI goal...");
      const { campaign } = await autoCampaignService.createFromGoal(
        config.goal,
        userId,
        config.serviceId ?? undefined
      );
      campaignId = campaign.id;

      await prisma.autopilotConfig.update({
        where: { userId },
        data: {
          activeCampaignId: campaignId,
          targetJobTitles: config.targetJobTitles.length
            ? config.targetJobTitles
            : [],
        },
      });
      log.push(`Campaign created: ${campaign.name}`);
    }

    if (!campaignId) {
      throw new ValidationError("No active campaign. Enable auto-create or assign one.");
    }

    // Step 2: Real LinkedIn search
    const keywords = autoCampaignService.buildSearchKeywords({
      targetJobTitles: config.targetJobTitles,
      targetIndustries: config.targetIndustries,
      targetCountries: config.targetCountries,
      goal: config.goal,
    });

    log.push(`Searching LinkedIn: "${keywords}"`);

    const client = await linkedInAccountService.getClient(userId);
    const searchCount = Math.min(config.dailySearchLimit, 25);
    const results = await searchPeople(client, {
      keywords,
      count: searchCount,
    });

    await linkedInAccountService.incrementSearch(userId, 1);
    log.push(`Found ${results.length} profiles on LinkedIn`);

    const createdLeadIds: string[] = [];
    const errors: string[] = [];

    // Step 3: Create leads from real LinkedIn results
    for (const profile of results) {
      try {
        const existing = await prisma.lead.findFirst({
          where: {
            OR: [
              { linkedInUrl: profile.linkedInUrl },
              { fullName: profile.fullName, deletedAt: null },
            ],
          },
        });
        if (existing) {
          createdLeadIds.push(existing.id);
          continue;
        }

        const leadId = await linkedInService.createLeadFromLinkedInProfile(
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
          campaignId,
          userId
        );
        createdLeadIds.push(leadId);
      } catch (err) {
        errors.push(`${profile.fullName}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    log.push(`Created/updated ${createdLeadIds.length} leads`);

    // Step 4: Run full automation pipeline on each lead
    let automated = 0;
    const messageLimit = config.dailyMessageLimit;

    for (const leadId of createdLeadIds) {
      if (automated >= messageLimit) break;
      try {
        await automationService.runPipeline(leadId, userId);
        automated++;
        log.push(`Automated lead ${leadId}`);
      } catch (err) {
        errors.push(`Pipeline ${leadId}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    const result = {
      campaignId,
      keywords,
      profilesFound: results.length,
      leadsProcessed: createdLeadIds.length,
      automated,
      errors,
      log,
    };

    await prisma.autopilotConfig.update({
      where: { userId },
      data: {
        lastRunAt: new Date(),
        nextRunAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
        lastRunResult: result as unknown as Prisma.InputJsonValue,
      },
    });

    // Log discovery job
    await prisma.linkedInDiscoveryJob.create({
      data: {
        campaignId,
        createdById: userId,
        status: JobStatus.COMPLETED,
        searchCriteria: { keywords, autopilot: true },
        profileUrls: results.map((r) => r.linkedInUrl),
        targetCount: searchCount,
        leadsCreated: createdLeadIds.length,
        results: result as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    return result;
  }

  async runAllEnabled() {
    const configs = await prisma.autopilotConfig.findMany({
      where: {
        isEnabled: true,
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }],
      },
    });

    const results = [];
    for (const config of configs) {
      try {
        const result = await this.run(config.userId);
        results.push({ userId: config.userId, status: "success", result });
      } catch (err) {
        results.push({
          userId: config.userId,
          status: "failed",
          error: err instanceof Error ? err.message : "failed",
        });
      }
    }
    return results;
  }
}

export const autopilotService = new AutopilotService();
