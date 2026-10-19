import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminWrite } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { topUpPackService } from "@/services/top-up-pack.service";

interface Ctx {
  params: Promise<{ id: string }>;
}

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  credits: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().max(8).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
  reason: z.string().min(1).max(2000),
});

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const actor = await requireSuperAdminWrite();
    const { id } = await ctx.params;
    const body = updateSchema.parse(await request.json());
    const pack = await topUpPackService.update({
      id,
      ...body,
      actorUserId: actor.id,
    });
    return NextResponse.json(apiSuccess(pack));
  } catch (error) {
    return handleApiError(error);
  }
}

const archiveSchema = z.object({
  reason: z.string().min(1).max(2000),
});

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    const actor = await requireSuperAdminWrite();
    const { id } = await ctx.params;
    const body = archiveSchema.parse(await request.json());
    const pack = await topUpPackService.archive({
      id,
      reason: body.reason,
      actorUserId: actor.id,
    });
    return NextResponse.json(apiSuccess(pack));
  } catch (error) {
    return handleApiError(error);
  }
}
