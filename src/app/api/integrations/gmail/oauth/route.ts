import { NextRequest, NextResponse } from "next/server";
import { gmailOAuthService } from "@/services/gmail-oauth.service";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    const user = await requireOrgPermission("integrations.manage");
    const url = gmailOAuthService.buildAuthorizeUrl(
      user.organizationId,
      user.id
    );
    return NextResponse.json(apiSuccess({ url, configured: true }));
  } catch (error) {
    return handleApiError(error);
  }
}
