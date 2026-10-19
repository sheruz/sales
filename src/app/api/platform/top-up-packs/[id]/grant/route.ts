import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminWrite } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { topUpPackService } from "@/services/top-up-pack.service";

interface Ctx {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  organizationId: z.string().uuid(),
  reason: z.string().min(1).max(2000),
  idempotencyKey: z.string().min(1).max(200).optional(),
});

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const actor = await requireSuperAdminWrite();
    const { id } = await ctx.params;
    const body = schema.parse(await request.json());
    const result = await topUpPackService.grantPack({
      packId: id,
      organizationId: body.organizationId,
      reason: body.reason,
      idempotencyKey: body.idempotencyKey,
      actorUserId: actor.id,
    });
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
