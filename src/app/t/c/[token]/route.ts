import { NextRequest, NextResponse } from "next/server";
import { emailTrackingService } from "@/services/email-tracking.service";
import { env } from "@/lib/config/env";

export const dynamic = "force-dynamic";

function fallbackHome(): string {
  return env.APP_URL.replace(/\/$/, "") || "https://delvix.studio";
}

function clientIp(request: NextRequest): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

/** Public click redirect — logs CLICKED then 302 to destination. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  let dest: string | null = null;
  try {
    const { token } = await context.params;
    const result = await emailTrackingService.recordClick(
      decodeURIComponent(token),
      {
        userAgent: request.headers.get("user-agent"),
        ip: clientIp(request),
      }
    );
    dest = result.dest;
  } catch (err) {
    console.warn(
      "[track/click]",
      err instanceof Error ? err.message : err
    );
  }

  const target = dest && /^https?:\/\//i.test(dest) ? dest : fallbackHome();
  return NextResponse.redirect(target, { status: 302 });
}
