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
import { BILLING_ACTIONS } from "@/lib/billing/actions";
import { billingGateway } from "@/services/billing-gateway.service";
import { businessBrainService } from "@/services/business-brain.service";
import {
  scoreIcpFit,
  shouldSkipDeepAudit,
} from "@/lib/audit/icp-fit";
import { saveAuditScreenshot } from "@/lib/audit/evidence-store";
import { assertSafeOutboundUrlResolved } from "@/lib/security/ssrf";
import { DEEP_AUDIT_SITE_TIMEOUT_MS } from "@/lib/audit/deep/types";

type JobMeta = {
  enqueuedBy?: string | null;
  icpFit?: ReturnType<typeof scoreIcpFit>;
  reservationId?: string;
  creditIdempotencyKey?: string;
  creditsCharged?: number;
  creditsSettled?: "committed" | "refunded" | null;
};

function asJobMeta(raw: unknown): JobMeta {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as JobMeta;
  }
  return {};
}

export class DeepAuditService {
  /**
   * Enqueue a deep audit.
   * Reserves audit_deep (3) at enqueue; commits on worker DONE; refunds on permanent FAIL.
   * Re-enqueue while QUEUED/RUNNING returns the same job (no second charge).
   * Main app never launches browsers.
   */
  async enqueue(
    organizationId: string,
    companyId: string,
    userId?: string
  ): Promise<
    | { status: "QUEUED"; jobId: string; websiteAuditId: string; reused?: boolean }
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

    // Idempotent re-run: same in-flight job, no new credits
    const existing = await prisma.deepAuditJob.findFirst({
      where: {
        organizationId,
        companyId,
        status: {
          in: [DeepAuditJobStatus.QUEUED, DeepAuditJobStatus.RUNNING],
        },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing?.websiteAuditId) {
      return {
        status: "QUEUED",
        jobId: existing.id,
        websiteAuditId: existing.websiteAuditId,
        reused: true,
      };
    }

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
    const creditIdempotencyKey = `audit_deep:${organizationId}:${companyId}:${auditId}`;

    // Reserve only — commit on DONE, refund on permanent FAIL
    const auth = await billingGateway.authorize({
      organizationId,
      action: BILLING_ACTIONS.AUDIT_DEEP,
      idempotencyKey: creditIdempotencyKey,
      referenceType: "website_audit",
      referenceId: auditId,
      actorUserId: userId,
      purpose: "audit_deep",
    });

    if (!auth.allowed) {
      return { status: "PAUSED", reason: "out_of_credits" };
    }

    // Worker may sit in queue > default 15m reserve TTL
    await prisma.billingAuthorization
      .update({
        where: { id: auth.reservationId },
        data: { expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) },
      })
      .catch(() => undefined);

    try {
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
            reservationId: auth.reservationId,
            creditIdempotencyKey,
            creditsCharged: auth.credits,
            creditsSettled: null,
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
    } catch (err) {
      await billingGateway
        .refund({
          organizationId,
          reservationId: auth.reservationId,
          actorUserId: userId,
          reason: "enqueue_failed",
        })
        .catch(() => undefined);
      throw err;
    }

    return { status: "QUEUED", jobId, websiteAuditId: auditId };
  }

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

    const meta = asJobMeta(job.metadata);
    if (meta.reservationId && meta.creditsSettled !== "committed") {
      await billingGateway.commit({
        organizationId: job.organizationId,
        reservationId: meta.reservationId,
      });
      meta.creditsSettled = "committed";
    }

    await prisma.deepAuditJob.update({
      where: { id: job.id },
      data: {
        status: DeepAuditJobStatus.DONE,
        finishedAt: new Date(),
        error: null,
        metadata: meta as Prisma.InputJsonValue,
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

    const meta = asJobMeta(job.metadata);

    if (!retry) {
      // Permanent failure → refund reserved credits
      if (meta.reservationId && meta.creditsSettled !== "refunded") {
        await billingGateway
          .refund({
            organizationId: job.organizationId,
            reservationId: meta.reservationId,
            reason: "deep_audit_failed",
          })
          .catch(() => undefined);
        meta.creditsSettled = "refunded";
      }

      if (websiteAuditId) {
        await prisma.websiteAudit.update({
          where: { id: websiteAuditId },
          data: { status: WebsiteAuditStatus.FAILED, error },
        });
      }
      await prisma.company.update({
        where: { id: job.companyId },
        data: {
          auditStatus: CompanyAuditStatus.FAILED,
          auditError: error.slice(0, 500),
        },
      });
    }

    await prisma.deepAuditJob.update({
      where: { id: jobId },
      data: {
        status: retry ? DeepAuditJobStatus.QUEUED : DeepAuditJobStatus.FAILED,
        error,
        finishedAt: retry ? null : new Date(),
        lockedAt: null,
        lockedBy: null,
        metadata: meta as Prisma.InputJsonValue,
      },
    });
  }
}

export const deepAuditService = new DeepAuditService();
