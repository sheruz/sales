import prisma from "@/lib/db/prisma";
import {
  CompanyCrawlStatus,
  CompanyEnrichmentStatus,
  IntegrationPlatform,
  OpportunityStage,
  OpportunityStatus,
} from "@prisma/client";
import { sourcingJobService } from "@/services/sourcing-job.service";
import { enrichmentJobService } from "@/services/enrichment-job.service";
import { cronTickService } from "@/services/cron-tick.service";
import { apiUsageLogService } from "@/services/api-usage-log.service";
import { FUNNEL_STAGES } from "@/lib/crm/funnel-stage";
import { icpService } from "@/services/icp.service";

export class AutopilotOverviewService {
  async get(organizationId: string, userId: string) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      sourcing,
      enrichment,
      lastTick,
      googleCosts,
      totalCompanies,
      crawled,
      enriched,
      contacted,
      replied,
      meeting,
      won,
      integrations,
      icps,
      errors24h,
    ] = await Promise.all([
      sourcingJobService.getConfig(organizationId),
      enrichmentJobService.dashboard(organizationId),
      cronTickService.lastTick(),
      apiUsageLogService.totals(organizationId),
      prisma.company.count({
        where: { organizationId, deletedAt: null },
      }),
      prisma.company.count({
        where: {
          organizationId,
          deletedAt: null,
          crawlStatus: {
            in: [
              CompanyCrawlStatus.DONE,
              CompanyCrawlStatus.BLOCKED,
              CompanyCrawlStatus.FAILED,
            ],
          },
        },
      }),
      prisma.company.count({
        where: {
          organizationId,
          deletedAt: null,
          enrichmentStatus: CompanyEnrichmentStatus.ENRICHED,
        },
      }),
      prisma.opportunity.count({
        where: {
          organizationId,
          status: OpportunityStatus.OPEN,
          stage: {
            in: [
              OpportunityStage.CONTACTED,
              OpportunityStage.NEW,
              OpportunityStage.QUALIFIED,
            ],
          },
        },
      }),
      prisma.opportunity.count({
        where: {
          organizationId,
          stage: OpportunityStage.REPLIED,
        },
      }),
      prisma.opportunity.count({
        where: {
          organizationId,
          stage: OpportunityStage.MEETING,
        },
      }),
      prisma.opportunity.count({
        where: {
          organizationId,
          stage: OpportunityStage.WON,
        },
      }),
      prisma.userIntegration.findMany({
        where: {
          organizationId,
          userId,
          isConnected: true,
          platform: {
            in: [
              IntegrationPlatform.ANTHROPIC,
              IntegrationPlatform.OPENAI,
              IntegrationPlatform.GOOGLE_PLACES,
              IntegrationPlatform.HUNTER,
            ],
          },
        },
        select: { platform: true },
      }),
      icpService.list(organizationId, false),
      prisma.company.count({
        where: {
          organizationId,
          deletedAt: null,
          updatedAt: { gte: dayAgo },
          OR: [
            { crawlStatus: CompanyCrawlStatus.FAILED },
            { enrichmentStatus: CompanyEnrichmentStatus.FAILED },
          ],
        },
      }),
    ]);

    const platforms = new Set(integrations.map((i) => i.platform));
    const claudeOrOpenAi =
      platforms.has(IntegrationPlatform.ANTHROPIC) ||
      platforms.has(IntegrationPlatform.OPENAI);

    const funnel = FUNNEL_STAGES.map((s) => {
      let count = 0;
      if (s.key === "found") count = totalCompanies;
      else if (s.key === "crawled") count = crawled;
      else if (s.key === "enriched") count = enriched;
      else if (s.key === "contacted") count = contacted;
      else if (s.key === "replied") count = replied;
      else if (s.key === "meeting") count = meeting;
      else if (s.key === "won") count = won;
      return {
        ...s,
        count: s.comingSoon ? 0 : count,
        href:
          s.key === "found"
            ? "/dashboard/companies"
            : s.key === "crawled"
              ? "/dashboard/companies?funnel=crawled"
              : s.key === "enriched"
                ? "/dashboard/companies?funnel=enriched"
                : s.key === "contacted"
                  ? "/dashboard/opportunities?filter=contacted"
                  : s.key === "replied"
                    ? "/dashboard/opportunities?filter=replied"
                    : s.key === "meeting"
                      ? "/dashboard/opportunities?filter=meeting"
                      : s.key === "won"
                        ? "/dashboard/opportunities?filter=won"
                        : "/dashboard/companies",
      };
    });

    const lastCronRun = lastTick
      ? {
          startedAt: lastTick.startedAt.toISOString(),
          finishedAt: lastTick.finishedAt?.toISOString() ?? null,
          ok: lastTick.ok,
          stale: cronTickService.isStale(lastTick),
        }
      : null;

    return {
      funnel,
      checklist: [
        {
          key: "ai",
          label: "Claude / OpenAI connected",
          done: claudeOrOpenAi,
        },
        {
          key: "places",
          label: "Google Places key",
          done: platforms.has(IntegrationPlatform.GOOGLE_PLACES),
        },
        {
          key: "hunter",
          label: "Hunter key",
          done: platforms.has(IntegrationPlatform.HUNTER),
        },
        {
          key: "icp",
          label: "ICP set",
          done: icps.length > 0,
        },
        {
          key: "cron",
          label: "Cron running (last run < 15 min)",
          done: Boolean(lastCronRun && !lastCronRun.stale),
        },
        {
          key: "inboxes",
          label: "Sending inboxes",
          done: false,
          comingSoon: true,
          phase: 4,
        },
        {
          key: "calendar",
          label: "Google Calendar",
          done: false,
          comingSoon: true,
          phase: 5,
        },
        {
          key: "zoom",
          label: "Zoom",
          done: false,
          comingSoon: true,
          phase: 5,
        },
        {
          key: "meta",
          label: "Meta Lead Ads",
          done: false,
          comingSoon: true,
          phase: 6,
        },
      ],
      health: {
        lastCronRun,
        googleSpendTodayUsd: googleCosts.todayUsd,
        hunterCreditsRemaining: enrichment.creditsRemaining,
        hunterCreditsUsedToday: enrichment.creditsUsed,
        errorsLast24h: errors24h,
      },
      toggles: {
        sourcing: sourcing.enabled,
        autoCrawl: sourcing.autoCrawl,
        enrichment: enrichment.config.enabled,
      },
    };
  }
}

export const autopilotOverviewService = new AutopilotOverviewService();
