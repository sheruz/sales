import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enrichmentJobService } from "@/services/enrichment-job.service";
import {
  requireAnyOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const schema = z.object({
  limit: z.number().int().min(1).max(25).optional(),
});

/** Enrich a small batch (default 5) — manual test, no toggle required. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "integrations.manage",
      "campaigns.manage",
      "business_brain.manage",
    ]);
    await requireOrganizationContext();
    const body = schema.parse(await request.json().catch(() => ({})));
    const result = await enrichmentJobService.enrichBatch(
      user.organizationId,
      body.limit ?? 5,
      user.id
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
