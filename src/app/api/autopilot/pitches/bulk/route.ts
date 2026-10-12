import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { websiteAuditService } from "@/services/website-audit.service";
import {
  requireAnyOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const schema = z.object({
  pitchIds: z.array(z.string().uuid()).min(1).max(50),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "integrations.manage",
      "campaigns.manage",
      "business_brain.manage",
    ]);
    await requireOrganizationContext();
    const body = schema.parse(await request.json());
    const result = await websiteAuditService.bulkApprove(
      user.organizationId,
      body.pitchIds,
      user.id
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
