import { NextResponse } from "next/server";
import { businessBrainService } from "@/services/business-brain.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

/** Safe org-scoped business context for AI / opportunity analysis */
export async function GET() {
  try {
    await requireOrgPermission("organization.view");
    const user = await requireOrganizationContext();
    const context = await businessBrainService.getSafeContext(
      user.organizationId
    );
    return NextResponse.json(apiSuccess(context));
  } catch (error) {
    return handleApiError(error);
  }
}
