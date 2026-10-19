import { NextRequest, NextResponse } from "next/server";
import { requirePlatformRead } from "@/lib/auth/api-auth";
import { apiSuccess, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { planEditorService } from "@/services/plan-editor.service";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    await requirePlatformRead();
    const { id } = await ctx.params;
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    if (!from || !to) throw new ValidationError("from and to are required");
    const diff = await planEditorService.versionDiff(id, from, to);
    return NextResponse.json(apiSuccess(diff));
  } catch (error) {
    return handleApiError(error);
  }
}
