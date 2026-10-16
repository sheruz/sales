import { NextRequest, NextResponse } from "next/server";
import { outlookOAuthService } from "@/services/outlook-oauth.service";
import { env } from "@/lib/config/env";
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
        `${settings}&outlook_error=${encodeURIComponent(error)}`
      );
    }
    if (!code || !state) {
      return NextResponse.redirect(`${settings}&outlook_error=missing_code`);
    }

    await outlookOAuthService.handleCallback(code, state);
    return NextResponse.redirect(`${settings}&outlook_connected=1`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "outlook_oauth_failed";
    return NextResponse.redirect(
      `${env.APP_URL}${appHome("/settings")}?tab=integrations&outlook_error=${encodeURIComponent(message)}`
    );
  }
}
