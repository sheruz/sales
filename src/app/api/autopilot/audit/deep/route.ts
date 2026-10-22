import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deepAuditService } from "@/services/deep-audit.service";
import {
  requireAnyOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const schema = z.object({
  companyId: z.string().uuid(),
});

/** Enqueue Audit 2.0 (Playwright) — processed by sales-audit-worker only. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "integrations.manage",
      "campaigns.manage",
      "business_brain.manage",
    ]);
    await requireOrganizationContext();
    const body = schema.parse(await request.json());
    const result = await deepAuditService.enqueue(
      user.organizationId,
      body.companyId,
      user.id
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
