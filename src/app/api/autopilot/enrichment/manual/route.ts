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
  companyId: z.string().uuid(),
});

/**
 * Mark a company ENRICHED from existing contact details (manual leads).
 * Skips Hunter — does not consume enrichment credits.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "integrations.manage",
      "campaigns.manage",
      "business_brain.manage",
      "leads.update",
      "opportunities.update",
    ]);
    await requireOrganizationContext();
    const body = schema.parse(await request.json());
    const result = await enrichmentJobService.markManuallyEnriched(
      user.organizationId,
      body.companyId,
      user.id
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
