import { NextResponse } from "next/server";
import { linkedInOAuthService } from "@/services/linkedin-oauth.service";
import { requirePermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    await requirePermission("integrations:manage");
    const user = await requireOrganizationContext();
    const url = linkedInOAuthService.buildAuthorizeUrl(
      user.organizationId,
      user.id
    );
    return NextResponse.redirect(url);
  } catch (error) {
    return handleApiError(error);
  }
}
