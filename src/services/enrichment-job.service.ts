import prisma from "@/lib/db/prisma";
import {
  CompanyCrawlStatus,
  CompanyEnrichmentStatus,
  OpportunityEventType,
  OpportunityStage,
  OpportunityStatus,
  type Prisma,
} from "@prisma/client";
import { ValidationError } from "@/lib/api/response";
import { hunterService } from "@/services/hunter.service";
import { apiUsageLogService } from "@/services/api-usage-log.service";
import {
  DEFAULT_DOMAIN_BLOCKLIST,
  isDomainBlocked,
} from "@/lib/enrichment/domain-blocklist";
import {
  DEFAULT_TITLE_PRIORITY,
  pickBestGenericEmail,
  pickDecisionMaker,
} from "@/lib/enrichment/decision-maker";
import { isEnrollableVerification } from "@/lib/enrichment/verification";
import {
  EnrichmentApiError,
  EnrichmentRateLimitError,
} from "@/lib/enrichment/types";

export type EnrichmentConfig = {
  enabled: boolean;
  batchPerTick: number;
  dailyCreditLimit: number;
  allowAcceptAll: boolean;
  titlePriority: string[];
  domainBlocklist: string[];
  maxAttempts: number;
};

const DEFAULT_ENRICHMENT: EnrichmentConfig = {
  enabled: false,
  batchPerTick: 5,
  dailyCreditLimit: 50,
  allowAcceptAll: false,
  titlePriority: DEFAULT_TITLE_PRIORITY,
  domainBlocklist: DEFAULT_DOMAIN_BLOCKLIST,
  maxAttempts: 3,
};

function asEnrichmentConfig(raw: unknown): EnrichmentConfig {
  const s =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).enrichment
      : null;
  const o =
    s && typeof s === "object" && !Array.isArray(s)
      ? (s as Record<string, unknown>)
      : {};
  return {
    enabled: o.enabled === true,
    batchPerTick: Number(o.batchPerTick ?? DEFAULT_ENRICHMENT.batchPerTick),
    dailyCreditLimit: Number(
      o.dailyCreditLimit ?? DEFAULT_ENRICHMENT.dailyCreditLimit
    ),
    allowAcceptAll: o.allowAcceptAll === true,
    titlePriority: Array.isArray(o.titlePriority)
      ? (o.titlePriority as string[]).filter((t) => typeof t === "string")
      : DEFAULT_TITLE_PRIORITY,
    domainBlocklist: Array.isArray(o.domainBlocklist)
      ? (o.domainBlocklist as string[]).filter((t) => typeof t === "string")
      : DEFAULT_DOMAIN_BLOCKLIST,
    maxAttempts: Number(o.maxAttempts ?? DEFAULT_ENRICHMENT.maxAttempts),
  };
}

function startOfUtcDay() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function splitName(full: string | null | undefined, email: string) {
  const parts = (full || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  const local = email.split("@")[0] || "Contact";
  return { firstName: local, lastName: "" };
}

export class EnrichmentJobService {
  async getConfig(organizationId: string): Promise<EnrichmentConfig> {
    const row = await prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { settings: true },
    });
    return asEnrichmentConfig(row?.settings);
  }

  async setConfig(
    organizationId: string,
    patch: Partial<EnrichmentConfig>
  ): Promise<EnrichmentConfig> {
    const current = await this.getConfig(organizationId);
    const next: EnrichmentConfig = {
      ...current,
      ...patch,
      enabled:
        patch.enabled === undefined ? current.enabled : Boolean(patch.enabled),
      allowAcceptAll:
        patch.allowAcceptAll === undefined
          ? current.allowAcceptAll
          : Boolean(patch.allowAcceptAll),
      batchPerTick: Math.min(
        25,
        Math.max(1, patch.batchPerTick ?? current.batchPerTick)
      ),
      dailyCreditLimit: Math.min(
        10_000,
        Math.max(1, patch.dailyCreditLimit ?? current.dailyCreditLimit)
      ),
      maxAttempts: Math.min(
        10,
        Math.max(1, patch.maxAttempts ?? current.maxAttempts)
      ),
      titlePriority: patch.titlePriority ?? current.titlePriority,
      domainBlocklist: patch.domainBlocklist ?? current.domainBlocklist,
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
    prev.enrichment = next;

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

  async creditsUsedToday(organizationId: string): Promise<number> {
    const day = startOfUtcDay();
    const agg = await prisma.apiUsageLog.aggregate({
      where: {
        organizationId,
        provider: "hunter",
        createdAt: { gte: day },
      },
      _sum: { units: true },
    });
    return agg._sum.units ?? 0;
  }

  async dashboard(organizationId: string) {
    const day = startOfUtcDay();
    const config = await this.getConfig(organizationId);
    const [
      pending,
      enrichedToday,
      noContact,
      failed,
      skipped,
      creditsUsed,
      recentErrors,
      validContacts,
      riskyContacts,
    ] = await Promise.all([
      prisma.company.count({
        where: {
          organizationId,
          deletedAt: null,
          OR: [
            { enrichmentStatus: null },
            { enrichmentStatus: CompanyEnrichmentStatus.PENDING },
            {
              enrichmentStatus: CompanyEnrichmentStatus.FAILED,
              enrichmentAttempts: { lt: config.maxAttempts },
            },
          ],
          crawlStatus: {
            in: [CompanyCrawlStatus.DONE, CompanyCrawlStatus.BLOCKED],
          },
          domain: { not: null },
        },
      }),
      prisma.company.count({
        where: {
          organizationId,
          enrichmentStatus: CompanyEnrichmentStatus.ENRICHED,
          enrichedAt: { gte: day },
          deletedAt: null,
        },
      }),
      prisma.company.count({
        where: {
          organizationId,
          enrichmentStatus: CompanyEnrichmentStatus.NO_CONTACT,
          deletedAt: null,
        },
      }),
      prisma.company.count({
        where: {
          organizationId,
          enrichmentStatus: CompanyEnrichmentStatus.FAILED,
          deletedAt: null,
        },
      }),
      prisma.company.count({
        where: {
          organizationId,
          enrichmentStatus: CompanyEnrichmentStatus.SKIPPED,
          deletedAt: null,
        },
      }),
      this.creditsUsedToday(organizationId),
      prisma.company.findMany({
        where: {
          organizationId,
          enrichmentStatus: {
            in: [
              CompanyEnrichmentStatus.FAILED,
              CompanyEnrichmentStatus.SKIPPED,
            ],
          },
          deletedAt: null,
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          enrichmentStatus: true,
          enrichmentError: true,
          domain: true,
        },
      }),
      prisma.contact.count({
        where: {
          organizationId,
          source: "hunter",
          emailStatus: "valid",
          createdAt: { gte: day },
        },
      }),
      prisma.contact.count({
        where: {
          organizationId,
          source: "hunter",
          emailStatus: "accept_all",
          createdAt: { gte: day },
        },
      }),
    ]);

    let creditsRemaining: number | null = null;
    try {
      const provider = await hunterService.getProvider(organizationId);
      const credits = await provider.getCredits();
      creditsRemaining = credits.available;
    } catch {
      creditsRemaining = null;
    }

    return {
      config,
      pending,
      enrichedToday,
      noContact,
      failed,
      skipped,
      creditsUsed,
      creditsRemaining,
      dailyCreditLimit: config.dailyCreditLimit,
      validEmailsToday: validContacts,
      riskyEmailsToday: riskyContacts,
      recentErrors,
    };
  }

  async upsertContactByEmail(input: {
    organizationId: string;
    companyId: string;
    email: string;
    firstName: string;
    lastName: string;
    title?: string | null;
    linkedInUrl?: string | null;
    seniority?: string | null;
    emailStatus: string;
    source: string;
    metadata?: Record<string, unknown>;
  }) {
    const normalizedEmail = input.email.toLowerCase().trim();
    const fullName =
      `${input.firstName} ${input.lastName}`.trim() || normalizedEmail;

    const existing = await prisma.contact.findFirst({
      where: { organizationId: input.organizationId, normalizedEmail },
    });

    if (existing) {
      return prisma.contact.update({
        where: { id: existing.id },
        data: {
          companyId: input.companyId,
          firstName: input.firstName || existing.firstName,
          lastName: input.lastName || existing.lastName,
          fullName,
          title: input.title ?? existing.title,
          linkedInUrl: input.linkedInUrl ?? existing.linkedInUrl,
          seniority: input.seniority ?? existing.seniority,
          email: normalizedEmail,
          normalizedEmail,
          emailStatus: input.emailStatus,
          source: input.source,
          verifiedAt: new Date(),
          metadata: (input.metadata ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
        },
      });
    }

    return prisma.contact.create({
      data: {
        organizationId: input.organizationId,
        companyId: input.companyId,
        firstName: input.firstName,
        lastName: input.lastName,
        fullName,
        title: input.title ?? null,
        linkedInUrl: input.linkedInUrl ?? null,
        seniority: input.seniority ?? null,
        email: normalizedEmail,
        normalizedEmail,
        emailStatus: input.emailStatus,
        source: input.source,
        verifiedAt: new Date(),
        metadata: (input.metadata ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      },
    });
  }

  async ensureSourcedOpportunity(
    organizationId: string,
    companyId: string,
    contactId: string
  ) {
    const existing = await prisma.opportunity.findFirst({
      where: {
        organizationId,
        companyId,
        status: OpportunityStatus.OPEN,
      },
      orderBy: { createdAt: "asc" },
    });
    if (existing) {
      return prisma.opportunity.update({
        where: { id: existing.id },
        data: {
          primaryContactId: contactId,
          // Keep existing pipeline stage if already past SOURCED
          ...(existing.stage === OpportunityStage.SOURCED ||
          existing.stage === OpportunityStage.NEW
            ? {}
            : {}),
        },
      });
    }

    let source = await prisma.opportunitySource.findFirst({
      where: { organizationId, key: "google_places" },
    });
    if (!source) {
      source = await prisma.opportunitySource.create({
        data: {
          organizationId,
          key: "google_places",
          name: "Google Places",
          description: "Autopilot Google Places sourcing",
        },
      });
    }

    const opp = await prisma.opportunity.create({
      data: {
        organizationId,
        companyId,
        primaryContactId: contactId,
        sourceId: source.id,
        stage: OpportunityStage.SOURCED,
        status: OpportunityStatus.OPEN,
        whyNow: "Company sourced and enriched via Autopilot",
        recommendedAction: "Review contact before outreach enrollment",
      },
    });

    await prisma.opportunityEvent.create({
      data: {
        organizationId,
        opportunityId: opp.id,
        type: OpportunityEventType.CREATED,
        title: "Sourced opportunity created",
        description: "Created from Hunter enrichment",
      },
    });

    return opp;
  }

  async enrichOneCompany(
    organizationId: string,
    companyId: string,
    userId?: string
  ) {
    const config = await this.getConfig(organizationId);
    const company = await prisma.company.findFirst({
      where: { id: companyId, organizationId, deletedAt: null },
      include: { emails: true },
    });
    if (!company) throw new ValidationError("Company not found");

    const domain = (company.normalizedDomain || company.domain || "")
      .toLowerCase()
      .replace(/^www\./, "");

    if (
      !domain ||
      isDomainBlocked(domain, config.domainBlocklist)
    ) {
      await prisma.company.update({
        where: { id: company.id },
        data: {
          enrichmentStatus: CompanyEnrichmentStatus.SKIPPED,
          enrichmentError: "Domain on blocklist or missing",
          enrichedAt: new Date(),
        },
      });
      return { status: "SKIPPED" as const, reason: "blocklist" };
    }

    const crawlOk =
      company.crawlStatus === CompanyCrawlStatus.DONE ||
      company.crawlStatus === CompanyCrawlStatus.BLOCKED;
    if (!crawlOk) {
      return { status: "SKIPPED" as const, reason: "crawl_not_ready" };
    }

    const used = await this.creditsUsedToday(organizationId);
    if (used >= config.dailyCreditLimit) {
      throw new ValidationError("Daily Hunter credit limit reached");
    }

    const provider = await hunterService.getProvider(organizationId, userId);

    const isHunterPlanLimit = (message: string) =>
      /limited to \d+ email|current plan|upgrade your plan/i.test(message);

    try {
      let people: Awaited<
        ReturnType<typeof provider.domainSearch>
      >["people"] = [];
      let domainSearchNote: string | null = null;

      try {
        const search = await provider.domainSearch(domain);
        await apiUsageLogService.logHunter(organizationId, "domain_search", {
          domain,
          companyId: company.id,
        });
        people = search.people;
      } catch (searchErr) {
        const searchMsg =
          searchErr instanceof Error ? searchErr.message : "domain search failed";
        await apiUsageLogService.logHunter(organizationId, "domain_search", {
          domain,
          companyId: company.id,
          error: searchMsg,
        });
        // Free-plan limit (or empty search) → fall through to crawled emails
        if (isHunterPlanLimit(searchMsg)) {
          domainSearchNote = searchMsg;
          people = [];
        } else if (
          searchErr instanceof EnrichmentRateLimitError ||
          searchErr instanceof EnrichmentApiError
        ) {
          throw searchErr;
        } else {
          throw searchErr;
        }
      }

      let person = pickDecisionMaker(people, config.titlePriority);
      let emailStatus: string = "unknown";
      let source = "hunter";
      let isGenericFallback = false;

      if (person?.email) {
        const verified = await provider.verifyEmail(person.email);
        await apiUsageLogService.logHunter(organizationId, "email_verifier", {
          email: person.email,
          companyId: company.id,
        });
        emailStatus = verified.status;

        if (
          !isEnrollableVerification(verified.status, config.allowAcceptAll) &&
          verified.status !== "accept_all"
        ) {
          // invalid/unknown personal — try generic crawl fallback
          person = null;
        }
      }

      if (!person) {
        const generic = pickBestGenericEmail(
          company.emails.map((e) => ({ email: e.email, type: e.type }))
        );
        if (!generic) {
          await prisma.company.update({
            where: { id: company.id },
            data: {
              enrichmentStatus: CompanyEnrichmentStatus.NO_CONTACT,
              enrichmentError:
                domainSearchNote ||
                "No Hunter person or crawled email",
              enrichedAt: new Date(),
              enrichmentAttempts: { increment: 1 },
            },
          });
          return { status: "NO_CONTACT" as const };
        }

        const verified = await provider.verifyEmail(generic);
        await apiUsageLogService.logHunter(organizationId, "email_verifier", {
          email: generic,
          companyId: company.id,
          fallback: true,
        });
        emailStatus = verified.status;
        isGenericFallback = true;
        const names = splitName(null, generic);
        person = {
          firstName: names.firstName,
          lastName: names.lastName,
          fullName: `${names.firstName} ${names.lastName}`.trim(),
          email: generic,
          title: null,
          seniority: null,
          linkedInUrl: null,
          confidence: null,
        };
        source = "website_crawl";
      }

      const names = splitName(
        person.fullName ||
          `${person.firstName || ""} ${person.lastName || ""}`,
        person.email
      );

      const contact = await this.upsertContactByEmail({
        organizationId,
        companyId: company.id,
        email: person.email,
        firstName: person.firstName || names.firstName,
        lastName: person.lastName || names.lastName,
        title: person.title,
        linkedInUrl: person.linkedInUrl,
        seniority: person.seniority,
        emailStatus,
        source,
        metadata: {
          enrollable: isEnrollableVerification(
            emailStatus as "valid" | "accept_all" | "invalid" | "unknown",
            config.allowAcceptAll
          ),
          risky: emailStatus === "accept_all",
          genericFallback: isGenericFallback,
        },
      });

      await this.ensureSourcedOpportunity(
        organizationId,
        company.id,
        contact.id
      );

      await prisma.company.update({
        where: { id: company.id },
        data: {
          enrichmentStatus: CompanyEnrichmentStatus.ENRICHED,
          enrichmentError: null,
          enrichedAt: new Date(),
          enrichmentAttempts: { increment: 1 },
        },
      });

      return {
        status: "ENRICHED" as const,
        contactId: contact.id,
        emailStatus,
      };
    } catch (err) {
      if (
        err instanceof EnrichmentRateLimitError ||
        err instanceof EnrichmentApiError ||
        err instanceof Error
      ) {
        const message = err instanceof Error ? err.message : "enrichment failed";
        // Plan-limit is not a transient API failure — don't burn retries
        const planLimit = isHunterPlanLimit(message);
        const attempts = planLimit
          ? config.maxAttempts
          : company.enrichmentAttempts + 1;
        await prisma.company.update({
          where: { id: company.id },
          data: {
            enrichmentStatus: CompanyEnrichmentStatus.FAILED,
            enrichmentError: message.slice(0, 500),
            enrichmentAttempts: attempts,
          },
        });
        return {
          status: "FAILED" as const,
          error: message,
          attempts,
          retryable: !planLimit && attempts < config.maxAttempts,
        };
      }
      throw err;
    }
  }

  async enrichBatch(
    organizationId: string,
    limit = 5,
    userId?: string
  ) {
    const config = await this.getConfig(organizationId);
    const used = await this.creditsUsedToday(organizationId);
    if (used >= config.dailyCreditLimit) {
      throw new ValidationError("Daily Hunter credit limit reached");
    }

    let creditsRemaining: number | null = null;
    try {
      const provider = await hunterService.getProvider(organizationId, userId);
      const credits = await provider.getCredits();
      creditsRemaining = credits.available;
      if (creditsRemaining !== null && creditsRemaining < 2) {
        throw new ValidationError("Hunter credits too low to continue");
      }
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      // key missing / account check failed — enrichOne will surface
    }

    const take = Math.min(25, Math.max(1, limit));
    const companies = await prisma.company.findMany({
      where: {
        organizationId,
        deletedAt: null,
        domain: { not: null },
        crawlStatus: {
          in: [CompanyCrawlStatus.DONE, CompanyCrawlStatus.BLOCKED],
        },
        OR: [
          { enrichmentStatus: null },
          { enrichmentStatus: CompanyEnrichmentStatus.PENDING },
          {
            enrichmentStatus: CompanyEnrichmentStatus.FAILED,
            enrichmentAttempts: { lt: config.maxAttempts },
          },
        ],
      },
      orderBy: { createdAt: "asc" },
      take,
      select: { id: true, domain: true },
    });

    const results = [];
    for (const c of companies) {
      if (isDomainBlocked(c.domain, config.domainBlocklist)) {
        await prisma.company.update({
          where: { id: c.id },
          data: {
            enrichmentStatus: CompanyEnrichmentStatus.SKIPPED,
            enrichmentError: "Domain on blocklist",
            enrichedAt: new Date(),
          },
        });
        results.push({ companyId: c.id, status: "SKIPPED" });
        continue;
      }
      try {
        results.push({
          companyId: c.id,
          ...(await this.enrichOneCompany(organizationId, c.id, userId)),
        });
      } catch (err) {
        results.push({
          companyId: c.id,
          status: "FAILED",
          error: err instanceof Error ? err.message : "failed",
        });
        if (
          err instanceof ValidationError &&
          /credit|limit/i.test(err.message)
        ) {
          break;
        }
      }
    }

    return { processed: results.length, results, creditsRemaining };
  }

  async processTickForOrg(organizationId: string) {
    const config = await this.getConfig(organizationId);
    if (!config.enabled) {
      return { skipped: true, reason: "enrichment_off" as const };
    }
    const used = await this.creditsUsedToday(organizationId);
    if (used >= config.dailyCreditLimit) {
      return { skipped: true, reason: "daily_limit" as const };
    }
    return {
      skipped: false,
      ...(await this.enrichBatch(organizationId, config.batchPerTick)),
    };
  }

  async processAllEnabled() {
    const settings = await prisma.organizationSettings.findMany({
      select: { organizationId: true, settings: true },
    });
    const results = [];
    for (const row of settings) {
      const cfg = asEnrichmentConfig(row.settings);
      if (!cfg.enabled) continue;
      results.push({
        organizationId: row.organizationId,
        ...(await this.processTickForOrg(row.organizationId)),
      });
    }
    return { orgs: results.length, results };
  }
}

export const enrichmentJobService = new EnrichmentJobService();
