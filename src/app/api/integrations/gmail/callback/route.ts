import { NextRequest, NextResponse } from "next/server";
import { gmailOAuthService } from "@/services/gmail-oauth.service";
import { env } from "@/lib/config/env";
import { handleApiError } from "@/lib/api/error-handler";
import { appHome } from "@/lib/app-paths";

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const error = request.nextUrl.searchParams.get("error");
    const base = env.APP_URL;
    const settings = `${base}${appHome("/settings")}?tab=integrations`;

    if (error) {
      return NextResponse.redirect(
        `${settings}&gmail_error=${encodeURIComponent(error)}`
      );
    }
    if (!code || !state) {
      return NextResponse.redirect(`${settings}&gmail_error=missing_code`);
    }

    await gmailOAuthService.handleCallback(code, state);
    return NextResponse.redirect(`${settings}&gmail_connected=1`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "gmail_oauth_failed";
    return NextResponse.redirect(
      `${env.APP_URL}${appHome("/settings")}?tab=integrations&gmail_error=${encodeURIComponent(message)}`
    );
  }
}
