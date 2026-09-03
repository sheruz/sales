import prisma from "@/lib/db/prisma";
import { JobStatus } from "@prisma/client";
import { autoCampaignService } from "@/services/auto-campaign.service";
import { jobDiscoveryService } from "@/services/job-discovery.service";
import { automationService } from "@/services/automation.service";
import { ValidationError } from "@/lib/api/response";
import {
  assertAutopilotCanRun,
  AUTOPILOT_SAFE_DEFAULTS,
  effectiveRunLimit,
  getAutopilotUsage,
  incrementAutopilotAiCalls,
  incrementAutopilotEmails,
  incrementAutopilotLeads,
  resetAutopilotDailyIfNeeded,
} from "@/lib/autopilot/limits";
import {
  getOutreachChannelsForUser,
  isEmailConfiguredForOutreach,
} from "@/lib/outreach/channels";
import type { Prisma } from "@prisma/client";

export class AutopilotService {
  async getOrCreateConfig(organizationId: string, userId: string) {
    return prisma.autopilotConfig.upsert({
      where: { userId },
      create: {
        organizationId,
        userId,
        dailySearchLimit: AUTOPILOT_SAFE_DEFAULTS.dailySearchLimit,
        dailyMessageLimit: AUTOPILOT_SAFE_DEFAULTS.dailyMessageLimit,
        maxLeadsPerRun: AUTOPILOT_SAFE_DEFAULTS.maxLeadsPerRun,
        maxLeadsPerDay: AUTOPILOT_SAFE_DEFAULTS.maxLeadsPerDay,
        maxAiCallsPerDay: AUTOPILOT_SAFE_DEFAULTS.maxAiCallsPerDay,
      },
      update: {},
      include: {
        service: { select: { id: true, name: true } },
        activeCampaign: { select: { id: true, name: true, status: true } },
      },
    });
  }

  async getUsage(organizationId: string, userId: string) {
    await this.getOrCreateConfig(organizationId, userId);
    return getAutopilotUsage(userId);
  }

  async updateConfig(
    organizationId: string,
    userId: string,
    data: {
      isEnabled?: boolean;
      goal?: string;
      targetJobTitles?: string[];
      targetIndustries?: string[];
      targetCountries?: string[];
      dailySearchLimit?: number;
      dailyMessageLimit?: number;
      maxLeadsPerRun?: number;
      maxLeadsPerDay?: number;
      maxAiCallsPerDay?: number;
      autoCreateCampaigns?: boolean;
      serviceId?: string;
    }
  ) {
    await this.getOrCreateConfig(organizationId, userId);

    const capped = {
      ...data,
      ...(data.dailySearchLimit !== undefined
        ? { dailySearchLimit: Math.min(data.dailySearchLimit, 10) }
        : {}),
      ...(data.dailyMessageLimit !== undefined
        ? { dailyMessageLimit: Math.min(data.dailyMessageLimit, 10) }
        : {}),
      ...(data.maxLeadsPerRun !== undefined
        ? { maxLeadsPerRun: Math.min(data.maxLeadsPerRun, 10) }
        : {}),
      ...(data.maxLeadsPerDay !== undefined
        ? { maxLeadsPerDay: Math.min(data.maxLeadsPerDay, 20) }
        : {}),
      ...(data.maxAiCallsPerDay !== undefined
        ? { maxAiCallsPerDay: Math.min(data.maxAiCallsPerDay, 30) }
        : {}),
    };

    return prisma.autopilotConfig.update({
      where: { userId },
      data: capped,
      include: {
        service: { select: { id: true, name: true } },
        activeCampaign: { select: { id: true, name: true } },
      },
    });
  }

  async run(organizationId: string, userId: string) {
    await resetAutopilotDailyIfNeeded(userId);
    const config = await this.getOrCreateConfig(organizationId, userId);

    if (!config.isEnabled) {
      throw new ValidationError("Autopilot is not enabled");
    }

    if (!config.goal) {
      throw new ValidationError("Set an autopilot goal first");
    }

    if (!(await isEmailConfiguredForOutreach(organizationId, userId))) {
      throw new ValidationError(
        "Email not configured. Connect Email (SMTP) in Settings → Integrations."
      );
    }

    await assertAutopilotCanRun(userId);

    const runLimit = effectiveRunLimit(config);
    if (runLimit <= 0) {
      throw new ValidationError("Daily limits reached — no new leads will be created today");
    }

    const channels = await getOutreachChannelsForUser(userId);
    const log: string[] = [];
    log.push(`Mode: job-post discovery → email-only outreach`);
    log.push(`Safe limits: max ${runLimit} new leads this run, ${config.maxLeadsPerDay}/day total`);

    let campaignId = config.activeCampaignId;

    if (!campaignId && config.autoCreateCampaigns) {
      log.push("Creating campaign from AI goal...");
      const { campaign } = await autoCampaignService.createFromGoal(
        organizationId,
        config.goal,
        userId,
        config.serviceId ?? undefined
      );
      campaignId = campaign.id;
      await incrementAutopilotAiCalls(userId, 1);

      await prisma.autopilotConfig.update({
        where: { userId },
        data: { activeCampaignId: campaignId },
      });
      log.push(`Campaign created: ${campaign.name}`);
    }

    if (!campaignId) {
      throw new ValidationError("No active campaign. Enable auto-create or assign one.");
    }

    log.push(`Discovering job posts matching: ${config.goal.slice(0, 80)}...`);

    const { leadIds, errors, prospectsFound, skippedNoEmail } =
      await jobDiscoveryService.discoverFromJobPosts(
        organizationId,
        {
          jobTitles: config.targetJobTitles,
          industries: config.targetIndustries,
          countries: config.targetCountries,
          description: config.goal ?? undefined,
        },
        runLimit,
        campaignId,
        userId,
        config.goal
      );

    await incrementAutopilotAiCalls(userId, 1);
    await incrementAutopilotLeads(userId, leadIds.length);

    if (skippedNoEmail > 0) {
      log.push(`Skipped ${skippedNoEmail} leads without valid email`);
    }
    log.push(`Job posts matched: ${prospectsFound}, new leads created: ${leadIds.length}`);

    const usage = await getAutopilotUsage(userId);
    const emailsSentToday = usage?.dailyMessageCount ?? 0;
    const emailLimit = Math.min(
      config.dailyMessageLimit - emailsSentToday,
      runLimit
    );

    if (emailLimit <= 0) {
      throw new ValidationError("Daily email limit reached");
    }

    let emailsSent = 0;

    for (const leadId of leadIds) {
      if (emailsSent >= emailLimit) {
        log.push(`Stopped at daily email limit (${config.dailyMessageLimit})`);
        break;
      }
      try {
        await automationService.runPipeline(organizationId, leadId, userId, {
          channels,
          skipResearch: true,
        });
        emailsSent++;
        await incrementAutopilotAiCalls(userId, 1);
        await incrementAutopilotEmails(userId, 1);
        log.push(`Email sent for lead ${leadId}`);
      } catch (err) {
        errors.push(`Pipeline ${leadId}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    const cooldownMs = AUTOPILOT_SAFE_DEFAULTS.minHoursBetweenRuns * 60 * 60 * 1000;

    const result = {
      status: "completed",
      campaignId,
      discoveryMode: "job_posts",
      prospectsFound,
      newLeadsCreated: leadIds.length,
      emailsSent,
      errors,
      log,
      finishedAt: new Date().toISOString(),
    };

    await prisma.autopilotConfig.update({
      where: { userId },
      data: {
        lastRunAt: new Date(),
        nextRunAt: new Date(Date.now() + cooldownMs),
        lastRunResult: result as unknown as Prisma.InputJsonValue,
      },
    });

    await prisma.linkedInDiscoveryJob.create({
      data: {
        organizationId,
        campaignId,
        createdById: userId,
        status: JobStatus.COMPLETED,
        searchCriteria: { mode: "job_posts", goal: config.goal, runLimit },
        profileUrls: [],
        targetCount: runLimit,
        leadsCreated: leadIds.length,
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

    const byOrg = new Map<string, typeof configs>();
    for (const config of configs) {
      const list = byOrg.get(config.organizationId) ?? [];
      list.push(config);
      byOrg.set(config.organizationId, list);
    }

    const results = [];
    for (const [organizationId, orgConfigs] of byOrg) {
      for (const config of orgConfigs) {
        try {
          const usage = await getAutopilotUsage(config.userId);
          if (usage && usage.remainingLeadsToday <= 0) {
            results.push({
              organizationId,
              userId: config.userId,
              status: "skipped",
              reason: "Daily lead limit reached",
            });
            continue;
          }

          const result = await this.run(organizationId, config.userId);
          results.push({
            organizationId,
            userId: config.userId,
            status: "success",
            result,
          });
        } catch (err) {
          results.push({
            organizationId,
            userId: config.userId,
            status: "failed",
            error: err instanceof Error ? err.message : "failed",
          });
        }
      }
    }
    return results;
  }
}

export const autopilotService = new AutopilotService();
