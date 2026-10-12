import prisma from "@/lib/db/prisma";
import {
  CompanyCrawlStatus,
  CompanyEmailType,
  CompanyTimelineEventType,
  SearchQueryStatus,
  TimelineActor,
  type Prisma,
} from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { googlePlacesService } from "@/services/google-places.service";
import { apiUsageLogService } from "@/services/api-usage-log.service";
import { timelineService } from "@/services/timeline.service";
import {
  domainFromPlaceWebsite,
  resolveCompanyDedupe,
} from "@/lib/sourcing/company-dedupe";
import { crawlWebsiteForContacts } from "@/lib/sourcing/website-contact-crawler";
import type { GooglePlaceResult } from "@/lib/sourcing/adapters/google-places.adapter";

export type SourcingConfig = {
  enabled: boolean;
  /** Drain PENDING website crawls even when Places sourcing is OFF (default ON). */
  autoCrawl: boolean;
  queriesPerDay: number;
  companiesPerDay: number;
  queriesPerTick: number;
  crawlsPerTick: number;
};

const DEFAULT_SOURCING: SourcingConfig = {
  enabled: false,
  autoCrawl: true,
  queriesPerDay: 10,
  companiesPerDay: 50,
  queriesPerTick: 2,
  crawlsPerTick: 10,
};

function asConfig(raw: unknown): SourcingConfig {
  const s =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).sourcing
      : null;
  const o =
    s && typeof s === "object" && !Array.isArray(s)
      ? (s as Record<string, unknown>)
      : {};
  return {
    enabled: o.enabled === true,
    autoCrawl: o.autoCrawl !== false,
    queriesPerDay: Number(o.queriesPerDay ?? DEFAULT_SOURCING.queriesPerDay),
    companiesPerDay: Number(
      o.companiesPerDay ?? DEFAULT_SOURCING.companiesPerDay
    ),
    queriesPerTick: Number(o.queriesPerTick ?? DEFAULT_SOURCING.queriesPerTick),
    crawlsPerTick: Number(o.crawlsPerTick ?? DEFAULT_SOURCING.crawlsPerTick),
  };
}

function startOfUtcDay() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export class SourcingJobService {
  async getConfig(organizationId: string): Promise<SourcingConfig> {
    const row = await prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { settings: true },
    });
    return asConfig(row?.settings);
  }

  async setConfig(
    organizationId: string,
    patch: Partial<SourcingConfig>
  ): Promise<SourcingConfig> {
    const current = await this.getConfig(organizationId);
    const next: SourcingConfig = {
      ...current,
      ...patch,
      enabled:
        patch.enabled === undefined ? current.enabled : Boolean(patch.enabled),
      autoCrawl:
        patch.autoCrawl === undefined
          ? current.autoCrawl
          : Boolean(patch.autoCrawl),
      queriesPerDay: Math.min(
        100,
        Math.max(1, patch.queriesPerDay ?? current.queriesPerDay)
      ),
      companiesPerDay: Math.min(
        500,
        Math.max(1, patch.companiesPerDay ?? current.companiesPerDay)
      ),
      queriesPerTick: Math.min(
        5,
        Math.max(1, patch.queriesPerTick ?? current.queriesPerTick)
      ),
      crawlsPerTick: Math.min(
        20,
        Math.max(1, patch.crawlsPerTick ?? current.crawlsPerTick)
      ),
    };

    const existing = await prisma.organizationSettings.findUnique({
      where: { organizationId },
    });
    const prev =
      existing?.settings &&
      typeof existing.settings === "object" &&
      !Array.isArray(existing.settings)
        ? { ...(existing.settings as Record<string, unknown>) }
        : {};
    prev.sourcing = next;

    await prisma.organizationSettings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        settings: prev as Prisma.InputJsonValue,
      },
      update: { settings: prev as Prisma.InputJsonValue },
    });
    return next;
  }

  async dashboard(organizationId: string) {
    const day = startOfUtcDay();
    const [config, queries, companiesToday, pendingCrawls, costs, recentErrors] =
      await Promise.all([
        this.getConfig(organizationId),
        prisma.searchQuery.findMany({
          where: { organizationId },
          orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        }),
        prisma.company.count({
          where: {
            organizationId,
            source: "google_places",
            createdAt: { gte: day },
            deletedAt: null,
          },
        }),
        prisma.company.count({
          where: {
            organizationId,
            source: "google_places",
            crawlStatus: CompanyCrawlStatus.PENDING,
            deletedAt: null,
          },
        }),
        apiUsageLogService.totals(organizationId),
        prisma.company.findMany({
          where: {
            organizationId,
            source: "google_places",
            crawlStatus: {
              in: [CompanyCrawlStatus.FAILED, CompanyCrawlStatus.BLOCKED],
            },
            deletedAt: null,
          },
          orderBy: { updatedAt: "desc" },
          take: 10,
          select: {
            id: true,
            name: true,
            crawlStatus: true,
            crawlError: true,
            website: true,
          },
        }),
      ]);

    return {
      config,
      queries,
      companiesToday,
      pendingCrawls,
      costs,
      recentErrors,
    };
  }

  private async countQueriesRunToday(organizationId: string) {
    return prisma.searchQuery.count({
      where: {
        organizationId,
        lastRunAt: { gte: startOfUtcDay() },
      },
    });
  }

  private async countCompaniesCreatedToday(organizationId: string) {
    return prisma.company.count({
      where: {
        organizationId,
        source: "google_places",
        createdAt: { gte: startOfUtcDay() },
        deletedAt: null,
      },
    });
  }

  async upsertPlaceCompany(
    organizationId: string,
    place: GooglePlaceResult,
    geo: { country?: string | null; city?: string | null },
    opts?: { queryLabel?: string | null }
  ): Promise<{ companyId: string; created: boolean }> {
    const domain = domainFromPlaceWebsite(place.website);
    const byPlaceId = await prisma.company.findFirst({
      where: {
        organizationId,
        googlePlaceId: place.googlePlaceId,
        deletedAt: null,
      },
      select: { id: true },
    });
    const byDomain = domain
      ? await prisma.company.findFirst({
          where: {
            organizationId,
            deletedAt: null,
            OR: [{ domain }, { normalizedDomain: domain }],
          },
          select: { id: true },
        })
      : null;

    const match = resolveCompanyDedupe({ byPlaceId, byDomain });
    const metadata = {
      google: {
        rating: place.rating,
        types: place.types,
        lat: place.lat,
        lng: place.lng,
      },
    };
    const { deriveCompanyTimezone } = await import("@/lib/outbound/timezone");
    const tz = deriveCompanyTimezone({
      lat: place.lat,
      lng: place.lng,
      country: geo.country,
    });

    if (match.kind !== "none") {
      const existingTz = await prisma.company.findUnique({
        where: { id: match.companyId },
        select: { timezone: true },
      });
      const updated = await prisma.company.update({
        where: { id: match.companyId },
        data: {
          googlePlaceId: place.googlePlaceId,
          phone: place.phone ?? undefined,
          address: place.address ?? undefined,
          website: place.website ?? undefined,
          domain: domain ?? undefined,
          normalizedDomain: domain ?? undefined,
          country: geo.country ?? undefined,
          city: geo.city ?? undefined,
          // Only set timezone if missing — never overwrite manual edits
          ...(existingTz?.timezone
            ? {}
            : tz.timezone
              ? { timezone: tz.timezone }
              : {}),
          source: "google_places",
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
      if (place.website && !updated.crawlStatus) {
        await prisma.company.update({
          where: { id: updated.id },
          data: { crawlStatus: CompanyCrawlStatus.PENDING },
        });
      }
      return { companyId: updated.id, created: false };
    }

    const created = await prisma.company.create({
      data: {
        organizationId,
        name: place.name,
        googlePlaceId: place.googlePlaceId,
        phone: place.phone,
        address: place.address,
        website: place.website,
        domain,
        normalizedDomain: domain,
        country: geo.country ?? null,
        city: geo.city ?? null,
        timezone: tz.timezone,
        source: "google_places",
        metadata: metadata as Prisma.InputJsonValue,
        crawlStatus: place.website
          ? CompanyCrawlStatus.PENDING
          : CompanyCrawlStatus.DONE,
      },
    });
    await timelineService.record({
      organizationId,
      companyId: created.id,
      type: CompanyTimelineEventType.SOURCED,
      title: opts?.queryLabel
        ? `Found via Google query '${opts.queryLabel}'`
        : "Found via Google Places",
      details: {
        googlePlaceId: place.googlePlaceId,
        query: opts?.queryLabel ?? null,
      },
      actor: TimelineActor.SYSTEM,
      dedupeKey: "sourced",
    });
    return { companyId: created.id, created: true };
  }

  /** Run a single Text Search page for one query (cheap manual test). */
  async runOneQuery(
    organizationId: string,
    queryId: string,
    userId?: string
  ) {
    const query = await prisma.searchQuery.findFirst({
      where: { id: queryId, organizationId },
    });
    if (!query) throw new NotFoundError("Search query not found");
    if (query.status === SearchQueryStatus.PAUSED) {
      throw new ValidationError("Query is paused — set Active first");
    }

    const result = await googlePlacesService.textSearch({
      organizationId,
      userId,
      textQuery: query.query,
      pageToken: query.pageToken,
    });

    let created = 0;
    let updated = 0;
    for (const place of result.places) {
      const upsert = await this.upsertPlaceCompany(
        organizationId,
        place,
        {
          country: query.country,
          city: query.city,
        },
        { queryLabel: query.query }
      );
      if (upsert.created) created += 1;
      else updated += 1;
    }

    const done = !result.nextPageToken;
    await prisma.searchQuery.update({
      where: { id: query.id },
      data: {
        lastRunAt: new Date(),
        resultsCount: { increment: result.places.length },
        pageToken: result.nextPageToken,
        status: done ? SearchQueryStatus.DONE : SearchQueryStatus.ACTIVE,
        lastError: null,
      },
    });

    return {
      queryId: query.id,
      places: result.places.length,
      created,
      updated,
      nextPageToken: result.nextPageToken,
      done,
      estimatedCostUsd: result.estimatedCostUsd,
    };
  }

  async processTickForOrg(organizationId: string) {
    const config = await this.getConfig(organizationId);

    // Auto-crawl (default ON) drains PENDING websites even when Places sourcing is OFF.
    const crawlResults = config.autoCrawl
      ? await this.processCrawlBatch(organizationId, config.crawlsPerTick)
      : [];

    if (!config.enabled) {
      return {
        skipped: true,
        reason: "sourcing_off" as const,
        crawlResults,
      };
    }

    const [queriesToday, companiesToday] = await Promise.all([
      this.countQueriesRunToday(organizationId),
      this.countCompaniesCreatedToday(organizationId),
    ]);

    const queryBudget = Math.max(0, config.queriesPerDay - queriesToday);
    const companyBudget = Math.max(0, config.companiesPerDay - companiesToday);
    const queriesToRun = Math.min(config.queriesPerTick, queryBudget);

    const queryResults: unknown[] = [];
    if (queriesToRun > 0 && companyBudget > 0) {
      const due = await prisma.searchQuery.findMany({
        where: {
          organizationId,
          status: SearchQueryStatus.ACTIVE,
        },
        orderBy: [{ lastRunAt: "asc" }, { createdAt: "asc" }],
        take: queriesToRun,
      });

      for (const q of due) {
        if (
          (await this.countCompaniesCreatedToday(organizationId)) >=
          config.companiesPerDay
        ) {
          break;
        }
        try {
          queryResults.push(await this.runOneQuery(organizationId, q.id));
        } catch (err) {
          await prisma.searchQuery.update({
            where: { id: q.id },
            data: {
              lastError: err instanceof Error ? err.message : "search failed",
              lastRunAt: new Date(),
            },
          });
          queryResults.push({
            queryId: q.id,
            error: err instanceof Error ? err.message : "search failed",
          });
        }
      }
    }

    return {
      skipped: false,
      queryResults,
      crawlResults,
    };
  }

  async processCrawlBatch(
    organizationId: string,
    limit: number,
    companyIds?: string[]
  ) {
    const pending = await prisma.company.findMany({
      where: {
        organizationId,
        website: { not: null },
        deletedAt: null,
        ...(companyIds?.length
          ? { id: { in: companyIds } }
          : {
              source: "google_places",
              crawlStatus: CompanyCrawlStatus.PENDING,
            }),
      },
      orderBy: { createdAt: "asc" },
      take: Math.max(1, limit),
    });

    const results = [];
    for (const company of pending) {
      if (!company.website) continue;
      try {
        const crawl = await crawlWebsiteForContacts(company.website);
        await prisma.company.update({
          where: { id: company.id },
          data: {
            crawlStatus: crawl.status as CompanyCrawlStatus,
            crawledAt: new Date(),
            crawlError: crawl.error ?? null,
            phone: company.phone || crawl.phones[0] || undefined,
            linkedInUrl: company.linkedInUrl || crawl.linkedInUrl || undefined,
            facebookUrl: company.facebookUrl || crawl.facebookUrl || undefined,
            instagramUrl:
              company.instagramUrl || crawl.instagramUrl || undefined,
          },
        });

        for (const e of crawl.emails) {
          await prisma.companyEmail.upsert({
            where: {
              companyId_email: {
                companyId: company.id,
                email: e.email,
              },
            },
            create: {
              organizationId,
              companyId: company.id,
              email: e.email,
              sourcePage: e.sourcePage,
              type:
                e.type === "PERSONAL"
                  ? CompanyEmailType.PERSONAL
                  : CompanyEmailType.GENERIC,
            },
            update: {
              sourcePage: e.sourcePage,
              type:
                e.type === "PERSONAL"
                  ? CompanyEmailType.PERSONAL
                  : CompanyEmailType.GENERIC,
            },
          });
        }

        const crawlType =
          crawl.status === "BLOCKED"
            ? CompanyTimelineEventType.CRAWL_BLOCKED
            : crawl.status === "FAILED"
              ? CompanyTimelineEventType.CRAWL_FAILED
              : CompanyTimelineEventType.CRAWLED;
        await timelineService.record({
          organizationId,
          companyId: company.id,
          type: crawlType,
          title:
            crawl.status === "DONE"
              ? "Website crawled"
              : crawl.status === "BLOCKED"
                ? "Crawl blocked"
                : "Crawl finished",
          details: { status: crawl.status, error: crawl.error },
          actor: TimelineActor.SYSTEM,
          dedupeKey: `crawl_${crawl.status.toLowerCase()}`,
        });
        if (crawl.emails.length > 0) {
          await timelineService.record({
            organizationId,
            companyId: company.id,
            type: CompanyTimelineEventType.EMAILS_FOUND,
            title: `${crawl.emails.length} website email(s) found`,
            details: { count: crawl.emails.length },
            actor: TimelineActor.SYSTEM,
            dedupeKey: "emails_found",
          });
        }

        results.push({
          companyId: company.id,
          status: crawl.status,
          emails: crawl.emails.length,
        });
      } catch (err) {
        await prisma.company.update({
          where: { id: company.id },
          data: {
            crawlStatus: CompanyCrawlStatus.FAILED,
            crawledAt: new Date(),
            crawlError: err instanceof Error ? err.message : "crawl failed",
          },
        });
        await timelineService.record({
          organizationId,
          companyId: company.id,
          type: CompanyTimelineEventType.CRAWL_FAILED,
          title: "Crawl failed",
          details: {
            error: err instanceof Error ? err.message : "crawl failed",
          },
          actor: TimelineActor.SYSTEM,
          dedupeKey: "crawl_failed",
        });
        results.push({
          companyId: company.id,
          status: "FAILED",
          error: err instanceof Error ? err.message : "crawl failed",
        });
      }
    }
    return results;
  }

  /**
   * Cron: process orgs with Places sourcing ON, or autoCrawl + pending crawls.
   */
  async processAllEnabled() {
    const settings = await prisma.organizationSettings.findMany({
      select: { organizationId: true, settings: true },
    });
    const results = [];
    for (const row of settings) {
      const cfg = asConfig(row.settings);
      if (!cfg.enabled) {
        if (!cfg.autoCrawl) continue;
        const pending = await prisma.company.count({
          where: {
            organizationId: row.organizationId,
            source: "google_places",
            crawlStatus: CompanyCrawlStatus.PENDING,
            deletedAt: null,
          },
        });
        if (pending === 0) continue;
      }
      results.push({
        organizationId: row.organizationId,
        ...(await this.processTickForOrg(row.organizationId)),
      });
    }
    return { orgs: results.length, results };
  }
}

export const sourcingJobService = new SourcingJobService();
