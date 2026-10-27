import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deepAuditService } from "@/services/deep-audit.service";
import {
  requireAnyOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const postSchema = z.object({
  companyId: z.string().uuid(),
});

/** Enqueue Audit 2.0 (Playwright) — processed by sales-audit-worker only. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "integrations.manage",
      "campaigns.manage",
      "business_brain.manage",
      "opportunities.view",
      "leads.view",
    ]);
    await requireOrganizationContext();
    const body = postSchema.parse(await request.json());
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

/** Poll deep-audit status for a company (UI refresh every 3s). */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "integrations.manage",
      "campaigns.manage",
      "business_brain.manage",
      "opportunities.view",
      "leads.view",
    ]);
    await requireOrganizationContext();
    const companyId = request.nextUrl.searchParams.get("companyId");
    if (!companyId || !z.string().uuid().safeParse(companyId).success) {
      return NextResponse.json(
        { success: false, error: { message: "companyId required" } },
        { status: 400 }
      );
    }
    const status = await deepAuditService.getStatus(
      user.organizationId,
      companyId
    );
    return NextResponse.json(apiSuccess(status));
  } catch (error) {
    return handleApiError(error);
  }
}
