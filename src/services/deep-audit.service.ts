import { randomUUID } from "crypto";
import {
  CompanyAuditStatus,
  DeepAuditJobStatus,
  AuditEvidenceKind,
  WebsiteAuditStatus,
  type Prisma,
} from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { ValidationError } from "@/lib/api/response";
import { CREDIT_ACTIONS } from "@/lib/billing/credit-actions";
import {
  isOutOfCreditsPause,
  withCreditReservation,
} from "@/lib/billing/with-credits";
import { businessBrainService } from "@/services/business-brain.service";
import {
  scoreIcpFit,
  shouldSkipDeepAudit,
} from "@/lib/audit/icp-fit";
import { saveAuditScreenshot } from "@/lib/audit/evidence-store";
import { assertSafeOutboundUrlResolved } from "@/lib/security/ssrf";
import { DEEP_AUDIT_SITE_TIMEOUT_MS } from "@/lib/audit/deep/types";

export class DeepAuditService {
  /**
   * Enqueue a deep audit. Charges audit_deep only when worker starts (via claim).
   * Web app never launches browsers — only inserts DeepAuditJob.
   */
  async enqueue(
    organizationId: string,
    companyId: string,
    userId?: string
  ): Promise<
    | { status: "QUEUED"; jobId: string; websiteAuditId: string }
    | { status: "SKIPPED"; reason: "low_icp_fit"; fit: ReturnType<typeof scoreIcpFit> }
    | { status: "PAUSED"; reason: "out_of_credits" }
  > {
    const company = await prisma.company.findFirst({
      where: { id: companyId, organizationId, deletedAt: null },
    });
    if (!company) throw new ValidationError("Company not found");
    if (!company.website) throw new ValidationError("Company has no website");

    await assertSafeOutboundUrlResolved(
      company.website.includes("://")
        ? company.website
        : `https://${company.website}`,
      { allowHttp: true }
    );

    const brain = await businessBrainService.getSafeContext(organizationId);
    const fit = scoreIcpFit({
      companyIndustry: company.industry,
      companyCity: company.city,
      companyCountry: company.country,
      companyEmployeeCount: company.employeeCount,
      companySize: company.size,
      icpIndustries: brain.icps.flatMap((i) => i.industries),
      icpGeographies: brain.icps.flatMap((i) => [
        ...i.countries,
        ...i.regions,
      ]),
      icpEmployeeRanges: brain.icps.flatMap((i) => i.companySizes),
      // Places: rating/count only if already on company metadata — never fetch/store review text
      placesRating:
        company.metadata &&
        typeof company.metadata === "object" &&
        !Array.isArray(company.metadata) &&
        typeof (company.metadata as Record<string, unknown>).placesRating ===
          "number"
          ? ((company.metadata as Record<string, unknown>).placesRating as number)
          : null,
      placesReviewCount:
        company.metadata &&
        typeof company.metadata === "object" &&
        !Array.isArray(company.metadata) &&
        typeof (company.metadata as Record<string, unknown>)
          .placesReviewCount === "number"
          ? ((company.metadata as Record<string, unknown>)
              .placesReviewCount as number)
          : null,
    });

    if (shouldSkipDeepAudit(fit)) {
      await prisma.company.update({
        where: { id: companyId },
        data: {
          auditStatus: CompanyAuditStatus.SKIPPED,
          auditError: `low_icp_fit:${fit.score}`,
        },
      });
      await prisma.websiteAudit.create({
        data: {
          organizationId,
          companyId,
          status: WebsiteAuditStatus.SKIPPED,
          mode: "deep",
          icpFit: fit.band,
          icpFitScore: fit.score,
          findings: { skipped: true, reasons: fit.reasons } as Prisma.InputJsonValue,
        },
      });
      return { status: "SKIPPED", reason: "low_icp_fit", fit };
    }

    const auditId = randomUUID();
    const jobId = randomUUID();

    // Reserve credits at enqueue so concurrent jobs don't overspend; worker completes/refunds via same key
    const credited = await withCreditReservation({
      organizationId,
      actionType: CREDIT_ACTIONS.AUDIT_DEEP,
      idempotencyKey: `audit_deep:${organizationId}:${companyId}:${auditId}`,
      referenceType: "website_audit",
      referenceId: auditId,
      actorUserId: userId,
      fn: async () => {
        await prisma.websiteAudit.create({
          data: {
            id: auditId,
            organizationId,
            companyId,
            status: WebsiteAuditStatus.PENDING,
            mode: "deep",
            icpFit: fit.band,
            icpFitScore: fit.score,
          },
        });
        await prisma.deepAuditJob.create({
          data: {
            id: jobId,
            organizationId,
            companyId,
            websiteAuditId: auditId,
            status: DeepAuditJobStatus.QUEUED,
            metadata: {
              enqueuedBy: userId ?? null,
              icpFit: fit,
              // No Places review text ever stored
            } as Prisma.InputJsonValue,
          },
        });
        await prisma.company.update({
          where: { id: companyId },
          data: {
            auditStatus: CompanyAuditStatus.PENDING,
            auditError: null,
            auditAttempts: { increment: 1 },
          },
        });
        return { jobId, websiteAuditId: auditId };
      },
    });

    if (isOutOfCreditsPause(credited)) {
      return { status: "PAUSED", reason: "out_of_credits" };
    }
    return { status: "QUEUED", ...credited.result };
  }

  /** Claim up to `limit` queued jobs for this worker. */
  async claimJobs(workerId: string, limit: number) {
    const jobs = await prisma.deepAuditJob.findMany({
      where: { status: DeepAuditJobStatus.QUEUED },
      orderBy: { createdAt: "asc" },
      take: Math.min(10, Math.max(1, limit)),
    });
    const claimed = [];
    for (const job of jobs) {
      const updated = await prisma.deepAuditJob.updateMany({
        where: { id: job.id, status: DeepAuditJobStatus.QUEUED },
        data: {
          status: DeepAuditJobStatus.RUNNING,
          lockedBy: workerId,
          lockedAt: new Date(),
          startedAt: new Date(),
          attempts: { increment: 1 },
        },
      });
      if (updated.count === 1) claimed.push(job);
    }
    return claimed;
  }

  async processClaimedJob(jobId: string): Promise<void> {
    const job = await prisma.deepAuditJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== DeepAuditJobStatus.RUNNING) return;

    const company = await prisma.company.findFirst({
      where: { id: job.companyId, organizationId: job.organizationId },
    });
    if (!company?.website) {
      await this.failJob(job.id, job.websiteAuditId, "Company has no website");
      return;
    }

    const website = company.website.includes("://")
      ? company.website
      : `https://${company.website}`;

    // Dynamic import — browser code stays out of default Next server paths that don't call this
    const { runDeepBrowserAudit } = await import(
      "@/lib/audit/deep/browser-runner"
    );

    const result = await runDeepBrowserAudit({
      url: website,
      timeoutMs: DEEP_AUDIT_SITE_TIMEOUT_MS,
    });

    if (!result.ok) {
      await this.failJob(
        job.id,
        job.websiteAuditId,
        result.error || "Deep audit failed"
      );
      return;
    }

    const auditId = job.websiteAuditId;
    if (!auditId) {
      await this.failJob(job.id, null, "Missing websiteAuditId");
      return;
    }

    const evidenceIds: string[] = [];
    if (result.screenshots.desktop) {
      const saved = await saveAuditScreenshot({
        organizationId: job.organizationId,
        websiteAuditId: auditId,
        kind: "desktop",
        pngOrJpeg: result.screenshots.desktop,
      });
      const row = await prisma.auditEvidence.create({
        data: {
          organizationId: job.organizationId,
          companyId: job.companyId,
          websiteAuditId: auditId,
          kind: AuditEvidenceKind.SCREENSHOT_DESKTOP,
          relativePath: saved.relativePath,
          contentType: saved.contentType,
          byteSize: saved.byteSize,
          expiresAt: saved.expiresAt,
        },
      });
      evidenceIds.push(row.id);
    }
    if (result.screenshots.mobile) {
      const saved = await saveAuditScreenshot({
        organizationId: job.organizationId,
        websiteAuditId: auditId,
        kind: "mobile",
        pngOrJpeg: result.screenshots.mobile,
      });
      const row = await prisma.auditEvidence.create({
        data: {
          organizationId: job.organizationId,
          companyId: job.companyId,
          websiteAuditId: auditId,
          kind: AuditEvidenceKind.SCREENSHOT_MOBILE,
          relativePath: saved.relativePath,
          contentType: saved.contentType,
          byteSize: saved.byteSize,
          expiresAt: saved.expiresAt,
        },
      });
      evidenceIds.push(row.id);
    }

    await prisma.websiteAudit.update({
      where: { id: auditId },
      data: {
        status: WebsiteAuditStatus.DONE,
        findings: {
          deep: true,
          findings: result.findings,
          metrics: result.metrics,
          finalUrl: result.finalUrl,
          title: result.title,
          evidenceIds,
          // Explicit: no Places review text
          placesReviewText: null,
        } as Prisma.InputJsonValue,
        coreMetrics: result.metrics as unknown as Prisma.InputJsonValue,
      },
    });

    await prisma.company.update({
      where: { id: job.companyId },
      data: {
        auditStatus: CompanyAuditStatus.DONE,
        auditedAt: new Date(),
        auditError: null,
      },
    });

    await prisma.deepAuditJob.update({
      where: { id: job.id },
      data: {
        status: DeepAuditJobStatus.DONE,
        finishedAt: new Date(),
        error: null,
      },
    });
  }

  private async failJob(
    jobId: string,
    websiteAuditId: string | null | undefined,
    error: string
  ) {
    const job = await prisma.deepAuditJob.findUnique({ where: { id: jobId } });
    if (!job) return;
    const retry =
      job.attempts < job.maxAttempts &&
      !/SSRF|blocked/i.test(error);

    await prisma.deepAuditJob.update({
      where: { id: jobId },
      data: {
        status: retry ? DeepAuditJobStatus.QUEUED : DeepAuditJobStatus.FAILED,
        error,
        finishedAt: retry ? null : new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    });

    if (!retry && websiteAuditId) {
      await prisma.websiteAudit.update({
        where: { id: websiteAuditId },
        data: { status: WebsiteAuditStatus.FAILED, error },
      });
      await prisma.company.update({
        where: { id: job.companyId },
        data: {
          auditStatus: CompanyAuditStatus.FAILED,
          auditError: error.slice(0, 500),
        },
      });
    }
  }
}

export const deepAuditService = new DeepAuditService();
