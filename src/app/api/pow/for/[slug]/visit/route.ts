import { NextRequest, NextResponse } from "next/server";
import { powPreviewPageService } from "@/services/pow-preview-page.service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    let dwellMs = 0;
    try {
      const body = await request.json();
      dwellMs = Number(body?.dwellMs) || 0;
    } catch {
      /* beacon / empty */
    }
    const forwarded = request.headers.get("x-forwarded-for");
    const ip =
      forwarded?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    const result = await powPreviewPageService.recordVisit({
      publicSlug: decodeURIComponent(slug),
      userAgent: request.headers.get("user-agent"),
      ip,
      dwellMs,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
}
