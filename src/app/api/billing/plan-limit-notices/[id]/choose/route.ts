import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { planPauseService } from "@/services/plan-pause.service";

interface Ctx {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  selectedIds: z.array(z.string()).min(0),
});

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireOrgPermission("billing.manage");
    const { id } = await ctx.params;
    const body = schema.parse(await request.json());
    const result = await planPauseService.resolveChoice({
      noticeId: id,
      organizationId: user.organizationId,
      selectedIds: body.selectedIds,
      actorUserId: user.id,
    });
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
