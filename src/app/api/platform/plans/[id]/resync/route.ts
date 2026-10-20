import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminWrite } from "@/lib/auth/api-auth";
import { apiSuccess, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import prisma from "@/lib/db/prisma";
import { syncProductAndPrices } from "@/services/billing/provider-registry";
import { organizationService } from "@/services/organization.service";

interface Ctx {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  reason: z.string().min(1),
  planVersionId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const actor = await requireSuperAdminWrite();
    const { id } = await ctx.params;
    const body = schema.parse(await request.json());
    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new ValidationError("Plan not found");
    const versionId = body.planVersionId || plan.currentVersionId;
    if (!versionId) throw new ValidationError("No published version to sync");
    const result = await syncProductAndPrices({
      planId: id,
      planVersionId: versionId,
      reason: body.reason,
    });
    await organizationService.writePlatformAudit({
      actorUserId: actor.id,
      action: "plan.provider_resync",
      targetType: "plan",
      targetId: id,
      after: result,
      reason: body.reason,
    });
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
