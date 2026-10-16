import { NextRequest, NextResponse } from "next/server";
import { emailTrackingService } from "@/services/email-tracking.service";

export const dynamic = "force-dynamic";

/** Public open pixel — always returns a 1x1 GIF. */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    await emailTrackingService.recordOpen(decodeURIComponent(token));
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
