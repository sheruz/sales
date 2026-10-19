import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminWrite } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { planEditorService } from "@/services/plan-editor.service";

interface Ctx {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  applyMode: z.enum(["now", "renewal", "new_subscribers_only"]),
  editorRevision: z.number().int().nonnegative(),
  confirmPlanName: z.string().optional(),
  reason: z.string().min(1).max(2000),
});

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const actor = await requireSuperAdminWrite();
    const { id } = await ctx.params;
    const body = schema.parse(await request.json());
    const result = await planEditorService.publish({
      planId: id,
      applyMode: body.applyMode,
      editorRevision: body.editorRevision,
      confirmPlanName: body.confirmPlanName,
      actorUserId: actor.id,
      reason: body.reason,
    });
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
