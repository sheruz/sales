import { NextRequest, NextResponse } from "next/server";
import { automationService } from "@/services/automation.service";
import { autopilotService } from "@/services/autopilot.service";
import { sequenceExecutorService } from "@/services/sequence-executor.service";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

export async function POST(request: NextRequest) {
  try {
    assertCronAuthorized(request);

    const [automation, autopilot, sequences] = await Promise.all([
      automationService.processPendingJobs(),
      autopilotService.runAllEnabled(),
      sequenceExecutorService.processDueEnrollments(),
    ]);

    // Safe observability — counts only (no bodies/secrets)
    console.info("[cron/automation] sequence executor", {
      claimed: sequences.claimed,
      success: sequences.success,
      failed: sequences.failed,
      skipped: sequences.skipped,
      deferred: sequences.deferred,
      error: sequences.error,
    });

    return NextResponse.json(
      apiSuccess({
        automation,
        autopilot,
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
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
