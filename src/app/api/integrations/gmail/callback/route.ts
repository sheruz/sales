import { NextRequest, NextResponse } from "next/server";
import { gmailOAuthService } from "@/services/gmail-oauth.service";
import { env } from "@/lib/config/env";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const error = request.nextUrl.searchParams.get("error");
    const base = env.APP_URL;

    if (error) {
      return NextResponse.redirect(
        `${base}/dashboard/settings?tab=integrations&gmail_error=${encodeURIComponent(error)}`
      );
    }
    if (!code || !state) {
      return NextResponse.redirect(
        `${base}/dashboard/settings?tab=integrations&gmail_error=missing_code`
      );
    }

    await gmailOAuthService.handleCallback(code, state);
    return NextResponse.redirect(
      `${base}/dashboard/settings?tab=integrations&gmail_connected=1`
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "gmail_oauth_failed";
    return NextResponse.redirect(
      `${env.APP_URL}/dashboard/settings?tab=integrations&gmail_error=${encodeURIComponent(message)}`
    );
  }
}
