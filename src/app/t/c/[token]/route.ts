import { NextRequest, NextResponse } from "next/server";
import { emailTrackingService } from "@/services/email-tracking.service";
import { env } from "@/lib/config/env";

export const dynamic = "force-dynamic";

function fallbackHome(): string {
  return env.APP_URL.replace(/\/$/, "") || "https://delvix.studio";
}

/** Public click redirect — logs CLICKED then 302 to destination. */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  let dest: string | null = null;
  try {
    const { token } = await context.params;
    dest = await emailTrackingService.recordClick(decodeURIComponent(token));
  } catch (err) {
    console.warn(
      "[track/click]",
      err instanceof Error ? err.message : err
    );
  }

  const target = dest && /^https?:\/\//i.test(dest) ? dest : fallbackHome();
  return NextResponse.redirect(target, { status: 302 });
}
