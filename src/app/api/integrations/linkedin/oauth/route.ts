import { NextResponse } from "next/server";
import { linkedInOAuthService } from "@/services/linkedin-oauth.service";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    const user = await requireOrgPermission("integrations.manage");
    const url = linkedInOAuthService.buildAuthorizeUrl(
      user.organizationId,
      user.id
    );
    return NextResponse.redirect(url);
  } catch (error) {
    return handleApiError(error);
  }
}
