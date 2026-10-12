import prisma from "@/lib/db/prisma";
import {
  CatalogItemStatus,
  CompanyAuditStatus,
  CompanyCrawlStatus,
  CompanyEnrichmentStatus,
  IntegrationPlatform,
  OpportunityStage,
  OpportunityStatus,
} from "@prisma/client";
import { sourcingJobService } from "@/services/sourcing-job.service";
import { enrichmentJobService } from "@/services/enrichment-job.service";
import { websiteAuditService } from "@/services/website-audit.service";
import { outboundJobService } from "@/services/outbound-job.service";
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
      auditCfg,
      outboundCfg,
      lastTick,
      googleCosts,
      totalCompanies,
      crawled,
      enriched,
      audited,
      contacted,
      replied,
      meeting,
      won,
      integrations,
      icps,
      servicesCount,
      caseStudiesCount,
      outboundMailboxCount,
      errors24h,
    ] = await Promise.all([
      sourcingJobService.getConfig(organizationId),
      enrichmentJobService.dashboard(organizationId),
      websiteAuditService.getConfig(organizationId),
      outboundJobService.getConfig(organizationId),
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
      prisma.company.count({
        where: {
          organizationId,
          deletedAt: null,
          auditStatus: CompanyAuditStatus.DONE,
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
      prisma.service.count({
        where: {
          organizationId,
          OR: [{ isActive: true }, { status: CatalogItemStatus.ACTIVE }],
        },
      }),
      prisma.serviceCaseStudy.count({ where: { organizationId } }),
      prisma.outboundMailbox.count({ where: { organizationId } }),
      prisma.company.count({
        where: {
          organizationId,
          deletedAt: null,
          updatedAt: { gte: dayAgo },
          OR: [
            { crawlStatus: CompanyCrawlStatus.FAILED },
            { enrichmentStatus: CompanyEnrichmentStatus.FAILED },
            { auditStatus: CompanyAuditStatus.FAILED },
          ],
        },
      }),
    ]);

    const platforms = new Set(integrations.map((i) => i.platform));
    const claudeOrOpenAi =
      platforms.has(IntegrationPlatform.ANTHROPIC) ||
      platforms.has(IntegrationPlatform.OPENAI);
    const placesKey = platforms.has(IntegrationPlatform.GOOGLE_PLACES);

    const funnel = FUNNEL_STAGES.map((s) => {
      let count = 0;
      if (s.key === "found") count = totalCompanies;
      else if (s.key === "crawled") count = crawled;
      else if (s.key === "enriched") count = enriched;
      else if (s.key === "audited") count = audited;
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
                : s.key === "audited"
                  ? "/dashboard/companies?funnel=audited"
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
          done: placesKey,
        },
        {
          key: "pagespeed",
          label: "PageSpeed enabled (same Google key)",
          done: placesKey,
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
          key: "services",
          label: "Services / case studies filled",
          done: servicesCount > 0 && caseStudiesCount > 0,
        },
        {
          key: "cron",
          label: "Cron running (last run < 15 min)",
          done: Boolean(lastCronRun && !lastCronRun.stale),
        },
        {
          key: "outbound_compliance",
          label: "Outbound address + business name",
          done: Boolean(
            outboundCfg.physicalAddress.trim() &&
              outboundCfg.businessName.trim()
          ),
        },
        {
          key: "inboxes",
          label: "Outbound mailbox in pool",
          done: outboundMailboxCount > 0,
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
        audit: auditCfg.enabled,
        outbound: outboundCfg.enabled,
        shadowMode: outboundCfg.shadowMode,
      },
    };
  }
}

export const autopilotOverviewService = new AutopilotOverviewService();
