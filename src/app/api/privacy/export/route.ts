import { NextResponse } from "next/server";
import {
  requireOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { privacyExportService } from "@/services/privacy-export.service";

/** Start a ZIP/CSV export job (company_admin via organization.update). */
export async function POST() {
  try {
    await requireOrgPermission("organization.update");
    const user = await requireOrganizationContext();
    const job = await privacyExportService.createJob({
      organizationId: user.organizationId,
      userId: user.id,
    });
    return NextResponse.json(
      apiSuccess({
        id: job.id,
        status: job.status,
        downloadToken: job.downloadToken,
        createdAt: job.createdAt,
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/** Latest export job status for this org. */
export async function GET() {
  try {
    await requireOrgPermission("organization.update");
    const user = await requireOrganizationContext();
    const job = await privacyExportService.getLatestForOrg(user.organizationId);
    if (!job) {
      return NextResponse.json(apiSuccess({ job: null }));
    }
    // If still pending/processing, nudge processing (idempotent)
    if (job.status === "PENDING" || job.status === "PROCESSING") {
      void privacyExportService.processJob(job.id).catch(() => null);
    }
    return NextResponse.json(
      apiSuccess({
        job: {
          id: job.id,
          status: job.status,
          downloadToken: job.downloadToken,
          fileSizeBytes: job.fileSizeBytes,
          error: job.error,
          expiresAt: job.expiresAt,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          downloadPath:
            job.status === "READY"
              ? `/api/privacy/export/${job.downloadToken}/download`
              : null,
        },
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
