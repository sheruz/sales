import { readFile, stat } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { brandingAbsPath } from "@/lib/email/branding-fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serve runtime-uploaded branding images.
 * Next static `public/` often misses files written after build/deploy;
 * this route reads them from disk (or BRANDING_UPLOAD_DIR).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ orgId: string; filename: string }> }
) {
  const { orgId, filename } = await context.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(orgId)) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(filename) || filename.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const abs = brandingAbsPath(orgId, filename);
  try {
    const [buf, st] = await Promise.all([readFile(abs), stat(abs)]);
    const lower = filename.toLowerCase();
    const type = lower.endsWith(".jpg") || lower.endsWith(".jpeg")
      ? "image/jpeg"
      : lower.endsWith(".webp")
        ? "image/webp"
        : "image/png";
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Content-Length": String(buf.length),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        ETag: `"${st.mtimeMs.toFixed(0)}-${st.size}"`,
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
