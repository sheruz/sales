import { NextRequest, NextResponse } from "next/server";
import { powPreviewPageService } from "@/services/pow-preview-page.service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const result = await powPreviewPageService.removeBySlug(
      decodeURIComponent(slug)
    );
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
}
