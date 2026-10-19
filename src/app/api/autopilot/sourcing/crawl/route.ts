import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sourcingJobService } from "@/services/sourcing-job.service";
import {
  requireAnyOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const schema = z.object({
  limit: z.number().int().min(1).max(25).optional(),
});

/** Manually crawl a batch of PENDING company websites (no Places spend). */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "integrations.manage",
      "campaigns.manage",
      "business_brain.manage",
    ]);
    await requireOrganizationContext();
    const body = schema.parse(await request.json().catch(() => ({})));
    const limit = body.limit ?? 15;
    const results = await sourcingJobService.processCrawlBatch(
      user.organizationId,
      limit
    );
    const done = results.filter(
      (r) => "status" in r && r.status === "DONE"
    ).length;
    const failed = results.filter(
      (r) =>
        "status" in r && (r.status === "FAILED" || r.status === "BLOCKED")
    ).length;
    const emails = results.reduce(
      (sum, r) =>
        sum + ("emails" in r && typeof r.emails === "number" ? r.emails : 0),
      0
    );
    return NextResponse.json(
      apiSuccess({
        processed: results.length,
        done,
        failed,
        emailsFound: emails,
        results,
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
