import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requirePlatformRead,
  requireSuperAdminWrite,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { overrideAdminService } from "@/services/override-admin.service";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requirePlatformRead();
    const { id } = await ctx.params;
    const rows = await overrideAdminService.list(id);
    return NextResponse.json(apiSuccess({ overrides: rows }));
  } catch (error) {
    return handleApiError(error);
  }
}

const upsertSchema = z.object({
  key: z.string().min(1),
  limitValue: z.number().int().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  reason: z.string().min(1).max(2000),
});

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const actor = await requireSuperAdminWrite();
    const { id } = await ctx.params;
    const body = upsertSchema.parse(await request.json());
    const row = await overrideAdminService.upsert({
      organizationId: id,
      key: body.key,
      limitValue: body.limitValue,
      enabled: body.enabled,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      reason: body.reason,
      actorUserId: actor.id,
    });
    return NextResponse.json(apiSuccess(row));
  } catch (error) {
    return handleApiError(error);
  }
}

const deleteSchema = z.object({
  key: z.string().min(1),
  reason: z.string().min(1).max(2000),
});

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    const actor = await requireSuperAdminWrite();
    const { id } = await ctx.params;
    const body = deleteSchema.parse(await request.json());
    const result = await overrideAdminService.remove({
      organizationId: id,
      key: body.key,
      reason: body.reason,
      actorUserId: actor.id,
    });
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
