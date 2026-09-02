import { NextResponse } from "next/server";
import { linkedInOAuthService } from "@/services/linkedin-oauth.service";
import { requirePermission } from "@/lib/auth/api-auth";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    const user = await requirePermission("integrations:manage");
    const url = linkedInOAuthService.buildAuthorizeUrl(user.id);
    return NextResponse.redirect(url);
  } catch (error) {
    return handleApiError(error);
  }
}
