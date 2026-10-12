import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { unsubscribeService } from "@/services/unsubscribe.service";
import { handleApiError } from "@/lib/api/error-handler";

/** Public one-click unsubscribe (no login). RFC 8058 POST. */
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    let token = url.searchParams.get("token") || "";
    if (!token) {
      const ct = request.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const body = z
          .object({ token: z.string().min(1) })
          .parse(await request.json().catch(() => ({})));
        token = body.token;
      } else {
        const form = await request.formData().catch(() => null);
        token = String(form?.get("token") || "");
      }
    }
    const result = await unsubscribeService.applyToken(token);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, email: result.email });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const result = await unsubscribeService.applyToken(token);
  if (!result.ok) {
    return NextResponse.redirect(
      new URL(`/unsubscribe?error=${encodeURIComponent(result.error)}`, request.url)
    );
  }
  return NextResponse.redirect(
    new URL(`/unsubscribe?ok=1&email=${encodeURIComponent(result.email)}`, request.url)
  );
}
