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
  queryId: z.string().uuid(),
});

/** Run ONE search query page — cheap manual test. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "integrations.manage",
      "campaigns.manage",
      "business_brain.manage",
    ]);
    await requireOrganizationContext();
    const body = schema.parse(await request.json());
    const result = await sourcingJobService.runOneQuery(
      user.organizationId,
      body.queryId,
      user.id
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
