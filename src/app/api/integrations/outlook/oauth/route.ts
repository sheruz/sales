import { NextResponse } from "next/server";
import { outlookOAuthService } from "@/services/outlook-oauth.service";
import { requirePermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    await requirePermission("integrations:manage");
    const user = await requireOrganizationContext();
    const url = outlookOAuthService.buildAuthorizeUrl(
      user.organizationId,
      user.id
    );
    return NextResponse.json(apiSuccess({ url, configured: true }));
  } catch (error) {
    return handleApiError(error);
  }
}
