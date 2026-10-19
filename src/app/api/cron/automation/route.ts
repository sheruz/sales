import { NextRequest, NextResponse } from "next/server";
import { automationService } from "@/services/automation.service";
import { autopilotService } from "@/services/autopilot.service";
import { sequenceExecutorService } from "@/services/sequence-executor.service";
import { sourcingJobService } from "@/services/sourcing-job.service";
import { enrichmentJobService } from "@/services/enrichment-job.service";
import { websiteAuditService } from "@/services/website-audit.service";
import { outboundJobService } from "@/services/outbound-job.service";
import { aiReplyService } from "@/services/ai-reply.service";
import { cronTickService } from "@/services/cron-tick.service";
import { creditLedgerService } from "@/services/credit-ledger.service";
import { billingLifecycleService } from "@/services/billing-lifecycle.service";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

export async function POST(request: NextRequest) {
  try {
    assertCronAuthorized(request);

    const locked = await cronTickService.tryAcquireLock();
    if (!locked) {
      const tick = await cronTickService.startTick({
        skipped: true,
        skipReason: "advisory_lock_held",
      });
      await cronTickService.finishTick(tick.id, {
        ok: true,
        jobs: { skipped: true },
        counts: { reason: "advisory_lock_held" },
      });
      return NextResponse.json(
        apiSuccess({
          skipped: true,
          reason: "advisory_lock_held",
          tickId: tick.id,
        })
      );
    }

    const tick = await cronTickService.startTick();
    const errors: string[] = [];

    try {
      // S2: expire open RESERVEs + monthly grants (idempotent per org+period)
      let creditSweep = 0;
      let monthlyGrants = { orgs: 0, granted: 0 };
      try {
        creditSweep = await creditLedgerService.sweepExpiredReserves(200);
        monthlyGrants = await creditLedgerService.runMonthlyGrants();
      } catch (e: unknown) {
        errors.push(
          `credits: ${e instanceof Error ? e.message : "credits maintenance failed"}`
        );
      }

      let lifecycle = {
        trialExpired: 0,
        graceSuspended: 0,
        cancelReadOnly: 0,
        pendingVersionsApplied: 0,
        overridesExpired: 0,
        pauseNoticesApplied: 0,
      };
      try {
        lifecycle = await billingLifecycleService.runDaily();
      } catch (e: unknown) {
        errors.push(
          `lifecycle: ${e instanceof Error ? e.message : "lifecycle failed"}`
        );
      }

      const [
        automation,
        autopilot,
        sequences,
        sourcing,
        enrichment,
        audit,
        outbound,
        aiReplies,
      ] = await Promise.all([
          automationService.processPendingJobs().catch((e: unknown) => {
            errors.push(
              `automation: ${e instanceof Error ? e.message : "failed"}`
            );
            return { error: true };
          }),
          autopilotService.runAllEnabled().catch((e: unknown) => {
            errors.push(
              `autopilot: ${e instanceof Error ? e.message : "failed"}`
            );
            return { error: true };
          }),
          sequenceExecutorService.processDueEnrollments().catch((e: unknown) => {
            errors.push(
              `sequences: ${e instanceof Error ? e.message : "failed"}`
            );
            return {
              claimed: 0,
              success: 0,
              failed: 0,
              skipped: 0,
              deferred: 0,
              error: true,
              byStatus: {},
              results: [],
            };
          }),
          sourcingJobService.processAllEnabled().catch((e: unknown) => {
            errors.push(
              `sourcing: ${e instanceof Error ? e.message : "failed"}`
            );
            return { orgs: 0, results: [] };
          }),
          enrichmentJobService.processAllEnabled().catch((e: unknown) => {
            errors.push(
              `enrichment: ${e instanceof Error ? e.message : "failed"}`
            );
            return { orgs: 0, results: [] };
          }),
          websiteAuditService.processAllEnabled().catch((e: unknown) => {
            errors.push(`audit: ${e instanceof Error ? e.message : "failed"}`);
            return { orgs: 0, results: [] };
          }),
          outboundJobService.processAllEnabled().catch((e: unknown) => {
            errors.push(
              `outbound: ${e instanceof Error ? e.message : "failed"}`
            );
            return { orgs: 0, results: [] };
          }),
          aiReplyService.processAllEnabled().catch((e: unknown) => {
            errors.push(
              `ai_replies: ${e instanceof Error ? e.message : "failed"}`
            );
            return { organizations: 0, results: [] };
          }),
        ]);

      console.info("[cron/automation] tick", {
        tickId: tick.id,
        sequences: {
          claimed: sequences.claimed,
          success: sequences.success,
          failed: sequences.failed,
        },
        sourcingOrgs: sourcing.orgs,
        enrichmentOrgs: enrichment.orgs,
        auditOrgs: audit.orgs,
        outboundOrgs: outbound.orgs,
        aiReplyOrgs: aiReplies.organizations,
        creditSweep,
        monthlyGrants,
        lifecycle,
        errors: errors.length ? errors : undefined,
      });

      await cronTickService.finishTick(tick.id, {
        ok: errors.length === 0,
        jobs: {
          automation: true,
          autopilot: true,
          sequences: true,
          sourcing: true,
          enrichment: true,
          audit: true,
          outbound: true,
          aiReplies: true,
          credits: true,
          lifecycle: true,
        },
        counts: {
          sequencesClaimed: sequences.claimed,
          sequencesSuccess: sequences.success,
          sequencesFailed: sequences.failed,
          sourcingOrgs: sourcing.orgs,
          enrichmentOrgs: enrichment.orgs,
          auditOrgs: audit.orgs,
          outboundOrgs: outbound.orgs,
          aiReplyOrgs: aiReplies.organizations,
          creditSweep,
          monthlyGrantsGranted: monthlyGrants.granted,
          lifecycle,
        },
        errors: errors.length ? errors : null,
      });

      return NextResponse.json(
        apiSuccess({
          tickId: tick.id,
          automation,
          autopilot,
          credits: { sweep: creditSweep, monthlyGrants },
          lifecycle,
          sourcing: { orgs: sourcing.orgs },
          enrichment: { orgs: enrichment.orgs },
          audit: { orgs: audit.orgs },
          outbound: { orgs: outbound.orgs },
          aiReplies: { orgs: aiReplies.organizations },
          sequences: {
            claimed: sequences.claimed,
            success: sequences.success,
            failed: sequences.failed,
            skipped: sequences.skipped,
            deferred: sequences.deferred,
            error: sequences.error,
            byStatus: sequences.byStatus,
            results: sequences.results.map((r) => ({
              enrollmentId: r.enrollmentId,
              organizationId: r.organizationId,
              status: r.status,
              reason: r.reason,
            })),
          },
          errors,
        })
      );
    } finally {
      await cronTickService.releaseLock().catch(() => undefined);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
