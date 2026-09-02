import { NextRequest, NextResponse } from "next/server";
import { linkedInOAuthService } from "@/services/linkedin-oauth.service";
import { env } from "@/lib/config/env";

export async function GET(request: NextRequest) {
  const settingsUrl = `${env.APP_URL}/dashboard/settings?tab=integrations`;

  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const error = request.nextUrl.searchParams.get("error");

    if (error) {
      return NextResponse.redirect(`${settingsUrl}&linkedin_error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${settingsUrl}&linkedin_error=missing_code`);
    }

    await linkedInOAuthService.handleCallback(code, state);
    return NextResponse.redirect(`${settingsUrl}&linkedin_connected=1`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(`${settingsUrl}&linkedin_error=${encodeURIComponent(message)}`);
  }
}
