import { NextRequest, NextResponse } from "next/server";
import { requirePlatformRead } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { planEditorService } from "@/services/plan-editor.service";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requirePlatformRead();
    const { id } = await ctx.params;
    const preview = await planEditorService.previewPublish(id);
    return NextResponse.json(apiSuccess(preview));
  } catch (error) {
    return handleApiError(error);
  }
}
