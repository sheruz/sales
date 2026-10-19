import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PlanVisibility } from "@prisma/client";
import {
  requirePlatformRead,
  requireSuperAdminWrite,
} from "@/lib/auth/api-auth";
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
    const plan = await planEditorService.getPlan(id);
    const draft =
      plan.versions.find((v) => v.status === "DRAFT") ?? null;
    return NextResponse.json(
      apiSuccess({ plan, draft, registry: planEditorService.registryGrouped() })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

const saveSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(5000).optional().nullable(),
  visibility: z.nativeEnum(PlanVisibility).optional(),
  mostPopular: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  priceMonthly: z.number().nonnegative().optional(),
  priceYearly: z.number().nonnegative().optional(),
  currency: z.string().max(8).optional(),
  monthlyCredits: z.number().int().nonnegative().nullable().optional(),
  creditRolloverEnabled: z.boolean().optional(),
  creditRolloverCapMonths: z.number().int().nullable().optional(),
  features: z
    .array(
      z.object({
        featureKey: z.string(),
        enabled: z.boolean(),
        limitValue: z.number().int().nullable(),
      })
    )
    .optional(),
  editorRevision: z.number().int().nonnegative(),
  reason: z.string().min(1).max(2000),
});

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const actor = await requireSuperAdminWrite();
    const { id } = await ctx.params;
    const body = saveSchema.parse(await request.json());
    const draft = await planEditorService.saveDraft(id, body, actor.id);
    return NextResponse.json(apiSuccess({ draft }));
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
    const plan = await planEditorService.archivePlan(id, actor.id, body.reason);
    return NextResponse.json(apiSuccess(plan));
  } catch (error) {
    return handleApiError(error);
  }
}
