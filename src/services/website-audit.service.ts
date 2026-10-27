import { randomUUID } from "crypto";
import prisma from "@/lib/db/prisma";
import {
  CompanyAuditStatus,
  CompanyEnrichmentStatus,
  CompanyTimelineEventType,
  OutreachSequenceStatus,
  PitchReviewMode,
  PitchStatus,
  TimelineActor,
  WebsiteAuditStatus,
  type Prisma,
} from "@prisma/client";
import { ValidationError } from "@/lib/api/response";
import { googlePlacesService } from "@/services/google-places.service";
import { apiUsageLogService } from "@/services/api-usage-log.service";
import { timelineService } from "@/services/timeline.service";
import { businessBrainService } from "@/services/business-brain.service";
import { enrichmentJobService } from "@/services/enrichment-job.service";
import { fetchHomepageHtml } from "@/lib/audit/fetch-homepage";
import { runPageSpeed } from "@/lib/audit/pagespeed.adapter";
import { failingChecks, runRuleChecks } from "@/lib/audit/rule-checks";
import {
  buildPitchUserPayload,
  PITCH_SYSTEM_PROMPT,
  validatePitchAiResult,
  type PitchAiResult,
} from "@/lib/audit/pitch-prompt";
import { aiComplete, parseAIJson } from "@/lib/ai/provider";
import { estimateTokenCostUsd } from "@/lib/ai/usage";
import { isEnrollableVerification } from "@/lib/enrichment/verification";
import type { EmailVerificationStatus } from "@/lib/enrichment/types";
import {
  buildSequenceTemplateVars,
  renderSequenceTemplateDetailed,
} from "@/lib/sequences/runtime";
import { CREDIT_ACTIONS } from "@/lib/billing/credit-actions";
import {
  isOutOfCreditsPause,
  withCreditReservation,
} from "@/lib/billing/with-credits";

export type AuditConfig = {
  enabled: boolean;
  batchPerTick: number;
  dailyLimit: number;
  maxAttempts: number;
  pitchReviewMode: PitchReviewMode;
};

const DEFAULT_AUDIT: AuditConfig = {
  enabled: false,
  batchPerTick: 2,
  dailyLimit: 20,
  maxAttempts: 3,
  pitchReviewMode: PitchReviewMode.REVIEW_REQUIRED,
};

function asAuditConfig(raw: unknown): AuditConfig {
  const s =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).audit
      : null;
  const o =
    s && typeof s === "object" && !Array.isArray(s)
      ? (s as Record<string, unknown>)
      : {};
  const mode =
    o.pitchReviewMode === "AUTO_APPROVE"
      ? PitchReviewMode.AUTO_APPROVE
      : PitchReviewMode.REVIEW_REQUIRED;
  return {
    enabled: o.enabled === true,
    batchPerTick: Number(o.batchPerTick ?? DEFAULT_AUDIT.batchPerTick),
    dailyLimit: Number(o.dailyLimit ?? DEFAULT_AUDIT.dailyLimit),
    maxAttempts: Number(o.maxAttempts ?? DEFAULT_AUDIT.maxAttempts),
    pitchReviewMode: mode,
  };
}

function startOfUtcDay() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export class WebsiteAuditService {
  async getConfig(organizationId: string): Promise<AuditConfig> {
    const row = await prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { settings: true },
    });
    return asAuditConfig(row?.settings);
  }

  async setConfig(
    organizationId: string,
    patch: Partial<AuditConfig>
  ): Promise<AuditConfig> {
    const current = await this.getConfig(organizationId);
    const next: AuditConfig = {
      ...current,
      ...patch,
      enabled:
        patch.enabled === undefined ? current.enabled : Boolean(patch.enabled),
      batchPerTick: Math.min(
        5,
        Math.max(1, patch.batchPerTick ?? current.batchPerTick)
      ),
      dailyLimit: Math.min(
        500,
        Math.max(1, patch.dailyLimit ?? current.dailyLimit)
      ),
      maxAttempts: Math.min(
        10,
        Math.max(1, patch.maxAttempts ?? current.maxAttempts)
      ),
      pitchReviewMode:
        patch.pitchReviewMode ?? current.pitchReviewMode,
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
    prev.audit = {
      enabled: next.enabled,
      batchPerTick: next.batchPerTick,
      dailyLimit: next.dailyLimit,
      maxAttempts: next.maxAttempts,
      pitchReviewMode: next.pitchReviewMode,
    };

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

  async auditedToday(organizationId: string): Promise<number> {
    const day = startOfUtcDay();
    return prisma.websiteAudit.count({
      where: {
        organizationId,
        status: WebsiteAuditStatus.DONE,
        createdAt: { gte: day },
      },
    });
  }

  /** Companies eligible: ENRICHED + enrollable contact + website. */
  async findEligibleCompanyIds(
    organizationId: string,
    limit: number,
    config: AuditConfig,
    onlyIds?: string[]
  ) {
    const enrichmentCfg = await enrichmentJobService.getConfig(organizationId);
    const { isOutreachExcluded } = await import(
      "@/lib/crm/import/outreach-exclude"
    );
    const need = Math.max(1, limit);
    const eligible: string[] = [];
    // Keep paging — do not stop after the first small window (earlier companies
    // may be ENRICHED+website but lack enrollable contacts; dashboard counted
    // 14 while Audit now scanned only ~9 and returned 0).
    const pageSize = 50;
    let skip = 0;
    const maxScan = onlyIds?.length ? onlyIds.length : 500;

    while (eligible.length < need && skip < maxScan) {
      const companies = await prisma.company.findMany({
        where: {
          organizationId,
          deletedAt: null,
          enrichmentStatus: CompanyEnrichmentStatus.ENRICHED,
          website: { not: null },
          ...(onlyIds?.length ? { id: { in: onlyIds } } : {}),
          OR: [
            { auditStatus: null },
            { auditStatus: CompanyAuditStatus.PENDING },
            {
              auditStatus: CompanyAuditStatus.FAILED,
              auditAttempts: { lt: config.maxAttempts },
            },
          ],
        },
        orderBy: [{ enrichedAt: "asc" }, { createdAt: "asc" }],
        skip,
        take: pageSize,
        select: {
          id: true,
          website: true,
          metadata: true,
          contacts: {
            where: { email: { not: null } },
            orderBy: { createdAt: "asc" },
            take: 5,
            select: {
              id: true,
              emailStatus: true,
              metadata: true,
              status: true,
            },
          },
        },
      });
      if (!companies.length) break;

      for (const c of companies) {
        if (isOutreachExcluded({ companyMetadata: c.metadata })) continue;
        const ok = c.contacts.some(
          (ct) =>
            !isOutreachExcluded({
              companyMetadata: c.metadata,
              contactMetadata: ct.metadata,
              contactStatus: ct.status,
            }) &&
            isEnrollableVerification(
              (ct.emailStatus || "unknown") as EmailVerificationStatus,
              enrichmentCfg.allowAcceptAll
            )
        );
        if (ok) eligible.push(c.id);
        if (eligible.length >= need) break;
      }
      skip += companies.length;
      if (companies.length < pageSize) break;
    }
    return eligible;
  }

  async dashboard(organizationId: string) {
    const day = startOfUtcDay();
    const config = await this.getConfig(organizationId);
    const [
      pending,
      auditedToday,
      failed,
      draftPitches,
      approvedPitches,
      avgScore,
      pagespeedCost,
      claudeCost,
      recentErrors,
    ] = await Promise.all([
      this.findEligibleCompanyIds(organizationId, 100, config).then(
        (ids) => ids.length
      ),
      this.auditedToday(organizationId),
      prisma.company.count({
        where: {
          organizationId,
          auditStatus: CompanyAuditStatus.FAILED,
          deletedAt: null,
        },
      }),
      prisma.pitch.count({
        where: { organizationId, status: PitchStatus.DRAFT },
      }),
      prisma.pitch.count({
        where: { organizationId, status: PitchStatus.APPROVED },
      }),
      prisma.websiteAudit.aggregate({
        where: {
          organizationId,
          status: WebsiteAuditStatus.DONE,
          pageSpeedMobile: { not: null },
        },
        _avg: { pageSpeedMobile: true },
      }),
      apiUsageLogService.providerTotals(
        organizationId,
        ["google_pagespeed"],
        day
      ),
      apiUsageLogService.providerTotals(organizationId, ["anthropic"], day),
      prisma.company.findMany({
        where: {
          organizationId,
          auditStatus: CompanyAuditStatus.FAILED,
          deletedAt: null,
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          auditStatus: true,
          auditError: true,
          domain: true,
        },
      }),
    ]);

    const { deepAuditService } = await import(
      "@/services/deep-audit.service"
    );
    const deepEligibleRows = await deepAuditService.listEligibleRows(
      organizationId,
      25
    );

    return {
      config,
      pending,
      auditedToday,
      failed,
      draftPitches,
      approvedPitches,
      avgMobileScore: avgScore._avg.pageSpeedMobile
        ? Math.round(Number(avgScore._avg.pageSpeedMobile))
        : null,
      costs: {
        pagespeedTodayUsd: pagespeedCost.usd,
        pagespeedTodayCalls: pagespeedCost.calls,
        claudeTodayUsd: claudeCost.usd,
        claudeTodayCalls: claudeCost.calls,
      },
      recentErrors,
      deepEligibleRows,
    };
  }

  async auditOne(
    organizationId: string,
    companyId: string,
    userId?: string,
    opts?: { force?: boolean; regeneratePitch?: boolean }
  ) {
    const config = await this.getConfig(organizationId);
    const company = await prisma.company.findFirst({
      where: { id: companyId, organizationId, deletedAt: null },
      include: {
        contacts: { orderBy: { createdAt: "asc" }, take: 10 },
        opportunities: {
          where: { status: "OPEN" },
          orderBy: { updatedAt: "desc" },
          take: 5,
        },
      },
    });
    if (!company) throw new ValidationError("Company not found");
    if (!company.website) throw new ValidationError("Company has no website");
    if (company.enrichmentStatus !== CompanyEnrichmentStatus.ENRICHED) {
      throw new ValidationError("Company must be ENRICHED before audit");
    }

    const { isOutreachExcluded } = await import(
      "@/lib/crm/import/outreach-exclude"
    );
    if (isOutreachExcluded({ companyMetadata: company.metadata })) {
      throw new ValidationError(
        "Clients, partners, and do-not-contact companies are never audited"
      );
    }

    const enrichmentCfg = await enrichmentJobService.getConfig(organizationId);
    const enrollable = company.contacts.filter(
      (ct) =>
        !isOutreachExcluded({
          companyMetadata: company.metadata,
          contactMetadata: ct.metadata,
          contactStatus: ct.status,
        }) &&
        isEnrollableVerification(
          (ct.emailStatus || "unknown") as EmailVerificationStatus,
          enrichmentCfg.allowAcceptAll
        )
    );
    if (!enrollable.length) {
      throw new ValidationError(
        "No valid (or allowed risky) contact — skip audit spend"
      );
    }

    const usedToday = await this.auditedToday(organizationId);
    if (!opts?.force && usedToday >= config.dailyLimit) {
      throw new ValidationError("Daily audit limit reached");
    }

    const auditId = randomUUID();
    const enrollableSafe = enrollable
      .filter((c): c is typeof c & { email: string } => Boolean(c.email))
      .map((c) => ({
        id: c.id,
        firstName: c.firstName,
        title: c.title,
        email: c.email,
      }));
    if (!enrollableSafe.length) {
      throw new ValidationError(
        "No valid (or allowed risky) contact — skip audit spend"
      );
    }
    const credited = await withCreditReservation({
      organizationId,
      actionType: CREDIT_ACTIONS.AUDIT_PITCH,
      idempotencyKey: `audit_pitch:${organizationId}:${companyId}:${auditId}`,
      referenceType: "website_audit",
      referenceId: auditId,
      actorUserId: userId,
      fn: () =>
        this.runAuditCharged(
          organizationId,
          companyId,
          {
            id: company.id,
            name: company.name,
            website: company.website!,
            domain: company.domain,
            city: company.city,
            industry: company.industry,
            opportunities: company.opportunities.map((o) => ({
              id: o.id,
              primaryContactId: o.primaryContactId,
            })),
          },
          enrollableSafe,
          config,
          auditId,
          userId,
          opts
        ),
    });
    if (isOutOfCreditsPause(credited)) {
      return {
        status: "PAUSED" as const,
        reason: "out_of_credits" as const,
        companyId,
      };
    }
    return credited.result;
  }

  private async runAuditCharged(
    organizationId: string,
    companyId: string,
    // company row with contacts + opportunities from auditOne()
    company: {
      id: string;
      name: string;
      website: string;
      domain: string | null;
      city: string | null;
      industry: string | null;
      opportunities: Array<{
        id: string;
        primaryContactId: string | null;
      }>;
    },
    enrollable: Array<{
      id: string;
      firstName: string | null;
      title: string | null;
      email: string;
    }>,
    config: AuditConfig,
    auditId: string,
    userId?: string,
    opts?: { force?: boolean; regeneratePitch?: boolean }
  ) {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        auditAttempts: { increment: 1 },
        auditStatus: CompanyAuditStatus.PENDING,
        auditError: null,
      },
    });

    await prisma.websiteAudit.create({
      data: {
        id: auditId,
        organizationId,
        companyId,
        status: WebsiteAuditStatus.PENDING,
      },
    });

    let totalCost = 0;

    try {
      const apiKey = await googlePlacesService.resolveApiKey(
        organizationId,
        userId
      );
      const home = await fetchHomepageHtml(company.website);
      if (!home.ok || !home.html) {
        throw new Error(home.error || "Failed to fetch homepage");
      }

      const targetUrl = home.finalUrl || home.url || company.website;

      const mobile = await runPageSpeed(targetUrl, apiKey, "mobile", 45_000);
      await apiUsageLogService.logPageSpeed(organizationId, "mobile", {
        companyId,
        score: mobile.score,
        error: mobile.error,
      });

      let desktop = await runPageSpeed(targetUrl, apiKey, "desktop", 45_000);
      if (desktop.error && !desktop.score) {
        desktop = {
          ...desktop,
          score: null,
          error: desktop.error,
        };
      }
      await apiUsageLogService.logPageSpeed(organizationId, "desktop", {
        companyId,
        score: desktop.score,
        error: desktop.error,
        optional: true,
      });

      const brain = await businessBrainService.getSafeContext(organizationId);
      const industries = [
        company.industry || "",
        ...brain.icps.flatMap((i) => i.industries),
      ].filter(Boolean);

      const checks = await runRuleChecks({
        homepageUrl: targetUrl,
        finalUrl: home.finalUrl,
        html: home.html,
        pageSpeedMobile: mobile.score,
        pageSpeedDesktop: desktop.score,
        industries,
      });

      const caseStudies = await prisma.serviceCaseStudy.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          title: true,
          customerIndustry: true,
          problem: true,
          outcome: true,
        },
      });

      const primary = enrollable[0];
      const pitchPayload = buildPitchUserPayload({
        companyName: company.name,
        contactFirstName: primary.firstName,
        contactTitle: primary.title,
        contactEmail: primary.email,
        city: company.city,
        industry: company.industry,
        domain: company.domain,
        checks,
        services: brain.services.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
        })),
        caseStudies,
      });

      const ai = await aiComplete({
        organizationId,
        userId,
        feature: "website_audit_pitch",
        operation: "website_audit_pitch",
        purpose: "website_audit_pitch",
        temperature: 0.3,
        maxTokens: 1800,
        jsonMode: true,
        messages: [
          { role: "system", content: PITCH_SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(pitchPayload) },
        ],
      });

      const claudeCost =
        estimateTokenCostUsd({
          model: ai.model,
          promptTokens: ai.promptTokens,
          outputTokens: ai.outputTokens,
        }) ?? 0;
      totalCost += claudeCost;
      await apiUsageLogService.logClaudeAudit(organizationId, claudeCost, {
        companyId,
        model: ai.model,
        auditId,
      });

      let parsed: unknown;
      try {
        parsed = parseAIJson(ai.content);
      } catch {
        throw new Error("Claude returned invalid JSON");
      }
      const validated = validatePitchAiResult(parsed, checks);
      if (!validated.ok) {
        throw new Error(validated.error);
      }
      const pitchJson = validated.value;

      const findings = {
        failing: failingChecks(checks).map((c) => ({
          id: c.id,
          label: c.label,
          evidence: c.evidence,
          severity: c.severity,
        })),
        top_issues: pitchJson.top_issues,
      };

      await prisma.websiteAudit.update({
        where: { id: auditId },
        data: {
          status: WebsiteAuditStatus.DONE,
          pageSpeedMobile: mobile.score,
          pageSpeedDesktop: desktop.score,
          coreMetrics: {
            mobile: mobile.metrics,
            desktop: desktop.metrics,
            mobileError: mobile.error ?? null,
            desktopError: desktop.error ?? null,
          } as Prisma.InputJsonValue,
          checks: checks as unknown as Prisma.InputJsonValue,
          findings: findings as Prisma.InputJsonValue,
          pitch: pitchJson as unknown as Prisma.InputJsonValue,
          modelUsed: ai.model,
          costUsd: totalCost,
          error: null,
        },
      });

      await prisma.company.update({
        where: { id: companyId },
        data: {
          auditStatus: CompanyAuditStatus.DONE,
          auditedAt: new Date(),
          auditError: null,
        },
      });

      await timelineService.record({
        organizationId,
        companyId,
        type: CompanyTimelineEventType.AUDITED,
        title: `Website audited (mobile ${mobile.score ?? "—"}/100)`,
        details: {
          auditId,
          pageSpeedMobile: mobile.score,
          pageSpeedDesktop: desktop.score,
          failingCount: failingChecks(checks).length,
        },
        actor: TimelineActor.SYSTEM,
        userId: userId ?? null,
        dedupeKey: `audited:${auditId}`,
      });

      const opp =
        company.opportunities.find((o) => o.primaryContactId === primary.id) ||
        company.opportunities[0] ||
        null;

      await this.upsertPitchForContact({
        organizationId,
        companyId,
        contactId: primary.id,
        opportunityId: opp?.id ?? null,
        websiteAuditId: auditId,
        pitch: pitchJson,
        reviewMode: config.pitchReviewMode,
        userId,
        forceRegenerate: opts?.regeneratePitch === true,
      });

      return {
        status: "DONE" as const,
        auditId,
        companyId,
        pageSpeedMobile: mobile.score,
        pageSpeedDesktop: desktop.score,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Audit failed";
      await prisma.websiteAudit.update({
        where: { id: auditId },
        data: {
          status: WebsiteAuditStatus.FAILED,
          error: message.slice(0, 500),
          costUsd: totalCost || null,
        },
      });
      await prisma.company.update({
        where: { id: companyId },
        data: {
          auditStatus: CompanyAuditStatus.FAILED,
          auditError: message.slice(0, 500),
        },
      });
      await timelineService.record({
        organizationId,
        companyId,
        type: CompanyTimelineEventType.AUDIT_FAILED,
        title: "Website audit failed",
        details: { auditId, error: message.slice(0, 300) },
        actor: TimelineActor.SYSTEM,
        userId: userId ?? null,
        dedupeKey: `audit_failed:${auditId}`,
      });
      return {
        status: "FAILED" as const,
        auditId,
        companyId,
        error: message,
      };
    }
  }

  async upsertPitchForContact(input: {
    organizationId: string;
    companyId: string;
    contactId: string;
    opportunityId: string | null;
    websiteAuditId: string;
    pitch: PitchAiResult;
    reviewMode: PitchReviewMode;
    userId?: string;
    forceRegenerate?: boolean;
  }) {
    const existingApproved = await prisma.pitch.findFirst({
      where: {
        contactId: input.contactId,
        status: PitchStatus.APPROVED,
      },
      orderBy: { updatedAt: "desc" },
    });

    // Do not auto-replace APPROVED unless explicit regenerate
    if (existingApproved && !input.forceRegenerate) {
      return existingApproved;
    }

    if (input.forceRegenerate && existingApproved) {
      await prisma.pitch.update({
        where: { id: existingApproved.id },
        data: { status: PitchStatus.SUPERSEDED },
      });
    }

    const drafts = await prisma.pitch.findMany({
      where: {
        contactId: input.contactId,
        status: { in: [PitchStatus.DRAFT, PitchStatus.REJECTED] },
      },
    });
    if (drafts.length) {
      await prisma.pitch.updateMany({
        where: { id: { in: drafts.map((d) => d.id) } },
        data: { status: PitchStatus.SUPERSEDED },
      });
    }

    const autoApprove =
      input.reviewMode === PitchReviewMode.AUTO_APPROVE;
    const pitchId = randomUUID();
    const topIssue =
      input.pitch.finding_title?.trim() ||
      input.pitch.top_issues[0]?.issue ||
      null;

    const contact = await prisma.contact.findFirst({
      where: { id: input.contactId },
      select: { firstName: true },
    });
    const company = await prisma.company.findFirst({
      where: { id: input.companyId },
      select: { name: true, city: true },
    });
    const missingVars: string[] = [];
    if (!contact?.firstName?.trim()) missingVars.push("first_name");
    if (!company?.name?.trim()) missingVars.push("company_name");
    if (!input.pitch.personalized_first_line?.trim()) {
      missingVars.push("personalized_first_line");
    }
    if (!topIssue?.trim()) missingVars.push("top_issue");
    if (!input.pitch.recommended_service?.trim()) {
      missingVars.push("recommended_service");
    }
    if (!input.pitch.short_pitch?.trim()) missingVars.push("short_pitch");
    if (!input.pitch.finding_title?.trim()) missingVars.push("finding_title");
    if (!input.pitch.body_html?.trim()) missingVars.push("body_html");

    const row = await prisma.pitch.create({
      data: {
        id: pitchId,
        organizationId: input.organizationId,
        companyId: input.companyId,
        contactId: input.contactId,
        opportunityId: input.opportunityId,
        websiteAuditId: input.websiteAuditId,
        status: autoApprove ? PitchStatus.APPROVED : PitchStatus.DRAFT,
        personalizedFirstLine: input.pitch.personalized_first_line,
        shortPitch: input.pitch.short_pitch,
        topIssue,
        recommendedService: input.pitch.recommended_service,
        confidence: input.pitch.confidence,
        greeting: input.pitch.greeting,
        introHtml: input.pitch.intro_html,
        findingTitle: input.pitch.finding_title,
        findingText: input.pitch.finding_text,
        bodyHtml: input.pitch.body_html,
        preheader: input.pitch.preheader,
        editedByUser: false,
        missingVars,
        approvedAt: autoApprove ? new Date() : null,
        approvedBy: autoApprove ? input.userId ?? null : null,
      },
    });

    if (autoApprove) {
      await timelineService.record({
        organizationId: input.organizationId,
        companyId: input.companyId,
        contactId: input.contactId,
        opportunityId: input.opportunityId,
        type: CompanyTimelineEventType.PITCH_APPROVED,
        title: "Pitch auto-approved",
        details: { pitchId },
        actor: TimelineActor.SYSTEM,
        userId: input.userId ?? null,
        dedupeKey: `pitch_approved:${pitchId}`,
      });
    }

    return row;
  }

  async auditBatch(
    organizationId: string,
    limit = 3,
    userId?: string,
    onlyIds?: string[]
  ) {
    const config = await this.getConfig(organizationId);
    const used = await this.auditedToday(organizationId);
    if (used >= config.dailyLimit) {
      throw new ValidationError("Daily audit limit reached");
    }
    const remaining = config.dailyLimit - used;
    const take = Math.min(3, Math.max(1, limit), remaining);
    const ids = await this.findEligibleCompanyIds(
      organizationId,
      take,
      config,
      onlyIds
    );
    if (onlyIds?.length && ids.length === 0) {
      throw new ValidationError(
        "Not ready for audit: company needs ENRICHED status, a website, and a contact with a valid email. For manual leads use “Use client details” first."
      );
    }
    const results = [];
    for (const id of ids) {
      const one = await this.auditOne(organizationId, id, userId);
      results.push(one);
      if (
        one &&
        typeof one === "object" &&
        "status" in one &&
        one.status === "PAUSED"
      ) {
        break;
      }
    }
    return { processed: results.length, results };
  }

  async processTickForOrg(organizationId: string) {
    const config = await this.getConfig(organizationId);
    if (!config.enabled) {
      return { skipped: true, reason: "audit_off" as const };
    }
    const used = await this.auditedToday(organizationId);
    if (used >= config.dailyLimit) {
      return { skipped: true, reason: "daily_limit" as const };
    }
    const batch = Math.min(3, config.batchPerTick);
    return {
      skipped: false,
      ...(await this.auditBatch(organizationId, batch)),
    };
  }

  async processAllEnabled() {
    const settings = await prisma.organizationSettings.findMany({
      select: { organizationId: true, settings: true },
    });
    const { tenantAccessService } = await import(
      "@/services/tenant-access.service"
    );
    const results = [];
    for (const row of settings) {
      if (!(await tenantAccessService.canRunJob(row.organizationId, "audit"))) {
        continue;
      }
      const cfg = asAuditConfig(row.settings);
      if (!cfg.enabled) continue;
      results.push({
        organizationId: row.organizationId,
        ...(await this.processTickForOrg(row.organizationId)),
      });
    }
    return { orgs: results.length, results };
  }

  /**
   * Website audit card: prefer latest successful light (Audit 1.0) result.
   * Deep audits (mode=deep) are shown in the Deep audit panel, not here.
   */
  async latestAudit(organizationId: string, companyId: string) {
    const done = await prisma.websiteAudit.findFirst({
      where: {
        organizationId,
        companyId,
        mode: "light",
        status: WebsiteAuditStatus.DONE,
      },
      orderBy: { createdAt: "desc" },
    });
    if (done) return done;
    return prisma.websiteAudit.findFirst({
      where: {
        organizationId,
        companyId,
        mode: "light",
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async activePitchForCompany(organizationId: string, companyId: string) {
    const approved = await prisma.pitch.findFirst({
      where: {
        organizationId,
        companyId,
        status: PitchStatus.APPROVED,
      },
      orderBy: { updatedAt: "desc" },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fullName: true,
            email: true,
            title: true,
          },
        },
      },
    });
    if (approved) return approved;
    return prisma.pitch.findFirst({
      where: {
        organizationId,
        companyId,
        status: PitchStatus.DRAFT,
      },
      orderBy: { updatedAt: "desc" },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fullName: true,
            email: true,
            title: true,
          },
        },
      },
    });
  }

  async listDraftPitches(organizationId: string, take = 50) {
    return prisma.pitch.findMany({
      where: { organizationId, status: PitchStatus.DRAFT },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        company: { select: { id: true, name: true, city: true, website: true } },
        contact: {
          select: {
            id: true,
            firstName: true,
            fullName: true,
            email: true,
            title: true,
          },
        },
        websiteAudit: {
          select: {
            id: true,
            pageSpeedMobile: true,
            findings: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async approvePitch(
    organizationId: string,
    pitchId: string,
    userId: string
  ) {
    const pitch = await prisma.pitch.findFirst({
      where: { id: pitchId, organizationId },
    });
    if (!pitch) throw new ValidationError("Pitch not found");
    if (pitch.status === PitchStatus.APPROVED) return pitch;
    if (
      pitch.status !== PitchStatus.DRAFT &&
      pitch.status !== PitchStatus.REJECTED
    ) {
      throw new ValidationError("Only DRAFT/REJECTED pitches can be approved");
    }
    const updated = await prisma.pitch.update({
      where: { id: pitchId },
      data: {
        status: PitchStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy: userId,
      },
    });
    await timelineService.record({
      organizationId,
      companyId: pitch.companyId,
      contactId: pitch.contactId,
      opportunityId: pitch.opportunityId,
      type: CompanyTimelineEventType.PITCH_APPROVED,
      title: "Pitch approved",
      details: { pitchId },
      actor: TimelineActor.USER,
      userId,
      dedupeKey: `pitch_approved:${pitchId}`,
    });
    return updated;
  }

  async rejectPitch(
    organizationId: string,
    pitchId: string,
    userId: string
  ) {
    const pitch = await prisma.pitch.findFirst({
      where: { id: pitchId, organizationId },
    });
    if (!pitch) throw new ValidationError("Pitch not found");
    const updated = await prisma.pitch.update({
      where: { id: pitchId },
      data: { status: PitchStatus.REJECTED },
    });
    await timelineService.record({
      organizationId,
      companyId: pitch.companyId,
      contactId: pitch.contactId,
      opportunityId: pitch.opportunityId,
      type: CompanyTimelineEventType.PITCH_REJECTED,
      title: "Pitch rejected",
      details: { pitchId },
      actor: TimelineActor.USER,
      userId,
      dedupeKey: `pitch_rejected:${pitchId}:${Date.now()}`,
    });
    return updated;
  }

  async editPitch(
    organizationId: string,
    pitchId: string,
    userId: string,
    patch: {
      personalizedFirstLine?: string;
      shortPitch?: string;
      greeting?: string;
      introHtml?: string;
      findingTitle?: string;
      findingText?: string;
      bodyHtml?: string;
      preheader?: string;
    }
  ) {
    const pitch = await prisma.pitch.findFirst({
      where: { id: pitchId, organizationId },
    });
    if (!pitch) throw new ValidationError("Pitch not found");
    if (
      pitch.status !== PitchStatus.DRAFT &&
      pitch.status !== PitchStatus.APPROVED
    ) {
      throw new ValidationError("Cannot edit this pitch status");
    }
    const findingTitle =
      patch.findingTitle?.trim() || pitch.findingTitle || pitch.topIssue;
    const updated = await prisma.pitch.update({
      where: { id: pitchId },
      data: {
        personalizedFirstLine:
          patch.personalizedFirstLine?.trim() || pitch.personalizedFirstLine,
        shortPitch: patch.shortPitch?.trim() || pitch.shortPitch,
        greeting: patch.greeting?.trim() || pitch.greeting,
        introHtml: patch.introHtml?.trim() || pitch.introHtml,
        findingTitle,
        findingText: patch.findingText?.trim() || pitch.findingText,
        bodyHtml: patch.bodyHtml?.trim() || pitch.bodyHtml,
        preheader: patch.preheader?.trim() || pitch.preheader,
        topIssue: findingTitle || pitch.topIssue,
        editedByUser: true,
      },
    });
    await timelineService.record({
      organizationId,
      companyId: pitch.companyId,
      contactId: pitch.contactId,
      opportunityId: pitch.opportunityId,
      type: CompanyTimelineEventType.PITCH_EDITED,
      title: "Pitch edited",
      details: { pitchId },
      actor: TimelineActor.USER,
      userId,
      dedupeKey: `pitch_edited:${pitchId}:${Date.now()}`,
    });
    return updated;
  }

  async regeneratePitch(
    organizationId: string,
    pitchId: string,
    userId: string
  ) {
    const pitch = await prisma.pitch.findFirst({
      where: { id: pitchId, organizationId },
    });
    if (!pitch) throw new ValidationError("Pitch not found");
    return this.auditOne(organizationId, pitch.companyId, userId, {
      force: true,
      regeneratePitch: true,
    });
  }

  async bulkApprove(
    organizationId: string,
    pitchIds: string[],
    userId: string
  ) {
    const ids = [...new Set(pitchIds)].slice(0, 50);
    const results = [];
    for (const id of ids) {
      try {
        results.push({
          id,
          ok: true,
          pitch: await this.approvePitch(organizationId, id, userId),
        });
      } catch (err) {
        results.push({
          id,
          ok: false,
          error: err instanceof Error ? err.message : "failed",
        });
      }
    }
    return { results };
  }

  async emailPreviewForCompany(organizationId: string, companyId: string) {
    const [company, pitch, sequence] = await Promise.all([
      prisma.company.findFirst({
        where: { id: companyId, organizationId },
        include: {
          contacts: { take: 1, orderBy: { createdAt: "asc" } },
        },
      }),
      this.activePitchForCompany(organizationId, companyId),
      prisma.outreachSequence.findFirst({
        where: {
          organizationId,
          status: OutreachSequenceStatus.ACTIVE,
        },
        orderBy: { updatedAt: "desc" },
        include: {
          steps: { where: { isActive: true }, orderBy: { stepOrder: "asc" }, take: 1 },
        },
      }),
    ]);
    if (!company) return null;
    const contact = pitch?.contact || company.contacts[0] || null;
    const step = sequence?.steps[0] || null;
    const template =
      step?.bodyTemplate ||
      "Hi {{first_name}},\n\n{{personalized_first_line}}\n\n{{short_pitch}}\n\n—";
    const vars = buildSequenceTemplateVars({
      contact,
      company,
      pitch: pitch
        ? {
            personalizedFirstLine: pitch.personalizedFirstLine,
            shortPitch: pitch.shortPitch,
            topIssue: pitch.topIssue,
            recommendedService: pitch.recommendedService,
          }
        : null,
    });
    const rendered = renderSequenceTemplateDetailed(template, vars);
    return {
      subject: step?.subjectTemplate
        ? renderSequenceTemplateDetailed(step.subjectTemplate, vars).text
        : null,
      body: rendered.text,
      missingRequired: rendered.missingRequired,
      sequenceId: sequence?.id ?? null,
      sequenceName: sequence?.name ?? null,
      pitchId: pitch?.id ?? null,
    };
  }
}

export const websiteAuditService = new WebsiteAuditService();
