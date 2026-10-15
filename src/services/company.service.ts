import prisma from "@/lib/db/prisma";
import {
  CompanyAuditStatus,
  CompanyCrawlStatus,
  CompanyEnrichmentStatus,
  CompanyStatus,
  CompanyTimelineEventType,
  TimelineActor,
  type Prisma,
} from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { deriveCompanyFunnelStage } from "@/lib/crm/funnel-stage";
import { sourcingJobService } from "@/services/sourcing-job.service";
import { enrichmentJobService } from "@/services/enrichment-job.service";
import { websiteAuditService } from "@/services/website-audit.service";
import { timelineService } from "@/services/timeline.service";

/** Normalize a website or bare host to lowercase domain without www. */
export function extractDomain(website?: string | null): string | null {
  if (!website?.trim()) return null;
  try {
    const raw = website.includes("://") ? website : `https://${website}`;
    const host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    return host || null;
  } catch {
    const cleaned = website
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
    return cleaned || null;
  }
}

export function normalizeDomain(domain?: string | null): string | null {
  if (!domain?.trim()) return null;
  return (
    extractDomain(domain) ||
    domain.trim().toLowerCase().replace(/^www\./, "")
  );
}

export type CompanyWriteInput = {
  name: string;
  website?: string | null;
  linkedInUrl?: string | null;
  industry?: string | null;
  size?: string | null;
  description?: string | null;
  country?: string | null;
  city?: string | null;
  domain?: string | null;
  state?: string | null;
  employeeCount?: number | null;
  employeeRange?: string | null;
  revenueRange?: string | null;
  foundedYear?: number | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  technologies?: string[];
  fundingTotal?: number | null;
  lastFundingDate?: string | null;
  status?: CompanyStatus;
  source?: string | null;
  metadata?: unknown;
};

export type CompanyListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  domain?: string;
  source?: string;
  city?: string;
  crawlStatus?: string;
  enrichmentStatus?: string;
  funnel?: string;
  sort?: "name" | "createdAt" | "city";
  sortDir?: "asc" | "desc";
};

export class CompanyService {
  async list(organizationId: string, query: CompanyListQuery = {}) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const skip = (page - 1) * limit;
    const domainFilter = normalizeDomain(query.domain);

    const where: Prisma.CompanyWhereInput = {
      organizationId,
      deletedAt: null,
      ...(domainFilter
        ? {
            OR: [
              { domain: domainFilter },
              { normalizedDomain: domainFilter },
            ],
          }
        : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.city
        ? { city: { contains: query.city, mode: "insensitive" } }
        : {}),
      ...(query.crawlStatus
        ? { crawlStatus: query.crawlStatus as CompanyCrawlStatus }
        : {}),
      ...(query.enrichmentStatus
        ? {
            enrichmentStatus:
              query.enrichmentStatus as CompanyEnrichmentStatus,
          }
        : {}),
      ...(query.funnel === "crawled"
        ? {
            crawlStatus: {
              in: [
                CompanyCrawlStatus.DONE,
                CompanyCrawlStatus.BLOCKED,
                CompanyCrawlStatus.FAILED,
              ],
            },
          }
        : {}),
      ...(query.funnel === "enriched"
        ? { enrichmentStatus: CompanyEnrichmentStatus.ENRICHED }
        : {}),
      ...(query.funnel === "audited"
        ? { auditStatus: CompanyAuditStatus.DONE }
        : {}),
      ...(query.funnel === "audited_today"
        ? (() => {
            const day = new Date();
            day.setUTCHours(0, 0, 0, 0);
            return {
              auditStatus: CompanyAuditStatus.DONE,
              auditedAt: { gte: day },
            };
          })()
        : {}),
      ...(query.funnel === "audit_pending"
        ? {
            enrichmentStatus: CompanyEnrichmentStatus.ENRICHED,
            OR: [
              { auditStatus: null },
              { auditStatus: CompanyAuditStatus.PENDING },
              { auditStatus: CompanyAuditStatus.FAILED },
            ],
          }
        : {}),
      ...(query.funnel === "found" ? {} : {}),
      ...(query.search
        ? {
            AND: [
              {
                OR: [
                  { name: { contains: query.search, mode: "insensitive" } },
                  { domain: { contains: query.search, mode: "insensitive" } },
                  {
                    normalizedDomain: {
                      contains: query.search.toLowerCase(),
                      mode: "insensitive",
                    },
                  },
                ],
              },
            ],
          }
        : {}),
    };

    // Newest sourced companies on top by default (enrichment / review order)
    const sortField = query.sort ?? "createdAt";
    const sortDir = query.sortDir ?? "desc";

    const [items, total] = await Promise.all([
      prisma.company.findMany({
        where,
        orderBy: { [sortField]: sortDir },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              contacts: true,
              opportunities: true,
              emails: true,
            },
          },
          contacts: {
            orderBy: { createdAt: "asc" },
            take: 1,
            select: {
              id: true,
              fullName: true,
              email: true,
              emailStatus: true,
              title: true,
              source: true,
            },
          },
          opportunities: {
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: { id: true, stage: true, updatedAt: true },
          },
        },
      }),
      prisma.company.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        funnelStage: deriveCompanyFunnelStage({
          crawlStatus: item.crawlStatus,
          enrichmentStatus: item.enrichmentStatus,
          opportunityStage: item.opportunities[0]?.stage ?? null,
          audited: item.auditStatus === "DONE",
        }),
        bestContact: item.contacts[0] ?? null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getById(organizationId: string, id: string) {
    const company = await prisma.company.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        contacts: { orderBy: { createdAt: "desc" }, take: 50 },
        emails: { orderBy: { createdAt: "desc" }, take: 50 },
        timelineEvents: {
          orderBy: { createdAt: "desc" },
          take: 40,
        },
        opportunities: {
          orderBy: { updatedAt: "desc" },
          take: 30,
          include: {
            primaryContact: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
        inboxConversations: {
          orderBy: { lastMessageAt: "desc" },
          take: 20,
        },
        deals: {
          where: { deletedAt: null },
          orderBy: { updatedAt: "desc" },
          take: 20,
        },
        meetings: { orderBy: { date: "desc" }, take: 20 },
        _count: {
          select: {
            contacts: true,
            opportunities: true,
            deals: true,
            emails: true,
          },
        },
      },
    });
    if (!company) throw new NotFoundError("Company not found");

    const [latestAudit, activePitch, emailPreview] = await Promise.all([
      websiteAuditService.latestAudit(organizationId, id),
      websiteAuditService.activePitchForCompany(organizationId, id),
      websiteAuditService.emailPreviewForCompany(organizationId, id),
    ]);

    const newerAuditAvailable = Boolean(
      latestAudit &&
        activePitch &&
        latestAudit.id !== activePitch.websiteAuditId &&
        latestAudit.status === "DONE"
    );

    return {
      ...company,
      funnelStage: deriveCompanyFunnelStage({
        crawlStatus: company.crawlStatus,
        enrichmentStatus: company.enrichmentStatus,
        opportunityStage: company.opportunities[0]?.stage ?? null,
        audited: company.auditStatus === "DONE",
      }),
      latestAudit: latestAudit
        ? {
            id: latestAudit.id,
            status: latestAudit.status,
            pageSpeedMobile: latestAudit.pageSpeedMobile,
            pageSpeedDesktop: latestAudit.pageSpeedDesktop,
            checks: latestAudit.checks,
            findings: latestAudit.findings,
            createdAt: latestAudit.createdAt.toISOString(),
            modelUsed: latestAudit.modelUsed,
            costUsd:
              latestAudit.costUsd != null
                ? Number(latestAudit.costUsd)
                : null,
          }
        : null,
      activePitch: activePitch
        ? {
            id: activePitch.id,
            status: activePitch.status,
            personalizedFirstLine: activePitch.personalizedFirstLine,
            shortPitch: activePitch.shortPitch,
            topIssue: activePitch.topIssue,
            recommendedService: activePitch.recommendedService,
            confidence: activePitch.confidence,
            websiteAuditId: activePitch.websiteAuditId,
            editedByUser: activePitch.editedByUser,
          }
        : null,
      newerAuditAvailable,
      emailPreview,
    };
  }

  async bulkAction(
    organizationId: string,
    action: "crawl" | "enrich" | "skip" | "unskip",
    companyIds: string[],
    userId?: string
  ) {
    const ids = [...new Set(companyIds)].slice(0, 25);
    if (!ids.length) throw new ValidationError("No companies selected");

    const companies = await prisma.company.findMany({
      where: { organizationId, id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    const found = new Set(companies.map((c) => c.id));
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];

    if (action === "crawl") {
      const batch = await sourcingJobService.processCrawlBatch(
        organizationId,
        Math.min(25, ids.length),
        ids
      );
      for (const id of ids) {
        const hit = batch.find((b) => b.companyId === id);
        results.push({
          id,
          ok: Boolean(hit),
          error: hit ? undefined : "no website or crawl skipped",
        });
      }
      return { action, results };
    }

    if (action === "enrich") {
      for (const id of ids) {
        if (!found.has(id)) {
          results.push({ id, ok: false, error: "not found" });
          continue;
        }
        try {
          await enrichmentJobService.enrichOneCompany(
            organizationId,
            id,
            userId
          );
          results.push({ id, ok: true });
        } catch (err) {
          results.push({
            id,
            ok: false,
            error: err instanceof Error ? err.message : "failed",
          });
        }
      }
      return { action, results };
    }

    if (action === "skip") {
      await prisma.company.updateMany({
        where: { organizationId, id: { in: ids } },
        data: {
          enrichmentStatus: CompanyEnrichmentStatus.SKIPPED,
          enrichmentError: "Skipped by user",
          enrichedAt: new Date(),
        },
      });
      for (const id of ids) {
        await timelineService.record({
          organizationId,
          companyId: id,
          type: CompanyTimelineEventType.SKIPPED,
          title: "Skipped enrichment (bulk)",
          actor: TimelineActor.USER,
          userId: userId ?? null,
          dedupeKey: `skipped_user_${Date.now()}`,
        });
        results.push({ id, ok: true });
      }
      return { action, results };
    }

    // unskip
    await prisma.company.updateMany({
      where: { organizationId, id: { in: ids } },
      data: {
        enrichmentStatus: CompanyEnrichmentStatus.PENDING,
        enrichmentError: null,
        enrichmentAttempts: 0,
      },
    });
    for (const id of ids) {
      await timelineService.record({
        organizationId,
        companyId: id,
        type: CompanyTimelineEventType.UNSKIPPED,
        title: "Unskipped — back to enrichment queue",
        actor: TimelineActor.USER,
        userId: userId ?? null,
        dedupeKey: `unskipped_${Date.now()}_${id.slice(0, 8)}`,
      });
      results.push({ id, ok: true });
    }
    return { action, results };
  }

  async create(organizationId: string, input: CompanyWriteInput) {
    const domain =
      normalizeDomain(input.domain) || extractDomain(input.website);

    return prisma.company.create({
      data: {
        organizationId,
        name: input.name.trim(),
        domain,
        normalizedDomain: domain,
        website: input.website || null,
        linkedInUrl: input.linkedInUrl || null,
        industry: input.industry || null,
        size: input.size || input.employeeRange || null,
        employeeRange: input.employeeRange || input.size || null,
        employeeCount: input.employeeCount,
        description: input.description || null,
        country: input.country || null,
        state: input.state || null,
        city: input.city || null,
        revenueRange: input.revenueRange,
        foundedYear: input.foundedYear,
        instagramUrl: input.instagramUrl,
        facebookUrl: input.facebookUrl,
        technologies: input.technologies ?? [],
        fundingTotal: input.fundingTotal,
        lastFundingDate: input.lastFundingDate
          ? new Date(input.lastFundingDate)
          : null,
        status: input.status ?? CompanyStatus.ACTIVE,
        source: input.source,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    input: Partial<CompanyWriteInput>
  ) {
    const existing = await prisma.company.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Company not found");

    const domain =
      input.domain !== undefined
        ? normalizeDomain(input.domain) || extractDomain(input.website)
        : input.website !== undefined
          ? extractDomain(input.website) || existing.domain
          : undefined;

    try {
      return await prisma.company.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(domain !== undefined
            ? { domain, normalizedDomain: domain }
            : {}),
          ...(input.website !== undefined
            ? { website: input.website || null }
            : {}),
          ...(input.industry !== undefined
            ? { industry: input.industry || null }
            : {}),
          ...(input.description !== undefined
            ? { description: input.description || null }
            : {}),
          ...(input.country !== undefined
            ? { country: input.country || null }
            : {}),
          ...(input.city !== undefined ? { city: input.city || null } : {}),
          ...(input.state !== undefined ? { state: input.state || null } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.source !== undefined ? { source: input.source } : {}),
          ...(input.linkedInUrl !== undefined
            ? { linkedInUrl: input.linkedInUrl || null }
            : {}),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Unique constraint") || msg.includes("unique")) {
        throw new ValidationError(
          "A company with this domain already exists in your organization"
        );
      }
      throw err;
    }
  }

  /**
   * Org-scoped find-or-create. Domain match preferred, then name.
   * Never trusts client organizationId — caller must pass membership org.
   */
  async findOrCreate(
    organizationId: string,
    name: string,
    data?: Partial<CompanyWriteInput>
  ) {
    const domain =
      normalizeDomain(data?.domain) || extractDomain(data?.website);

    if (domain) {
      const byDomain = await prisma.company.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          OR: [{ domain }, { normalizedDomain: domain }],
        },
      });
      if (byDomain) {
        return prisma.company.update({
          where: { id: byDomain.id },
          data: {
            normalizedDomain: byDomain.normalizedDomain || domain,
            industry: data?.industry ?? undefined,
            description: data?.description ?? undefined,
            website: data?.website ?? undefined,
            linkedInUrl: data?.linkedInUrl ?? undefined,
            country: data?.country ?? undefined,
            city: data?.city ?? undefined,
            size: data?.size ?? data?.employeeRange ?? undefined,
            employeeRange: data?.employeeRange ?? data?.size ?? undefined,
          },
        });
      }
    }

    const existing = await prisma.company.findFirst({
      where: {
        organizationId,
        name: { equals: name, mode: "insensitive" },
        deletedAt: null,
      },
    });
    if (existing) {
      if (domain && !existing.domain) {
        try {
          return await prisma.company.update({
            where: { id: existing.id },
            data: {
              domain,
              normalizedDomain: domain,
              website: data?.website ?? existing.website,
            },
          });
        } catch {
          return existing;
        }
      }
      return existing;
    }

    return this.create(organizationId, {
      name,
      website: data?.website,
      linkedInUrl: data?.linkedInUrl,
      industry: data?.industry,
      size: data?.size,
      description: data?.description,
      country: data?.country,
      city: data?.city,
      domain,
      employeeRange: data?.employeeRange,
      source: data?.source ?? "system",
      ...data,
    });
  }
}

export const companyService = new CompanyService();
