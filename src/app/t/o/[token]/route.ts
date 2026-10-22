import { NextRequest, NextResponse } from "next/server";
import { emailTrackingService } from "@/services/email-tracking.service";

export const dynamic = "force-dynamic";

function clientIp(request: NextRequest): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

/** Public open pixel — always returns a 1x1 GIF. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    await emailTrackingService.recordOpen(decodeURIComponent(token), {
      userAgent: request.headers.get("user-agent"),
      ip: clientIp(request),
    });
  } catch (err) {
    console.warn(
      "[track/open]",
      err instanceof Error ? err.message : err
    );
  }

  return new NextResponse(new Uint8Array(emailTrackingService.transparentGif()), {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(emailTrackingService.transparentGif().length),
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
    },
  });
}
