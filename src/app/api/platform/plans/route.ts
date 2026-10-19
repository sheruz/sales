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

export async function GET() {
  try {
    await requirePlatformRead();
    const [plans, registry] = await Promise.all([
      planEditorService.listPlans(),
      Promise.resolve(planEditorService.registryGrouped()),
    ]);
    return NextResponse.json(apiSuccess({ plans, registry }));
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().max(64).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  visibility: z.nativeEnum(PlanVisibility).optional(),
  reason: z.string().min(1).max(2000),
});

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperAdminWrite();
    const body = createSchema.parse(await request.json());
    const result = await planEditorService.createPlan({
      ...body,
      actorUserId: actor.id,
    });
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
