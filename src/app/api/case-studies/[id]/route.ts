import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OfferStatus } from "@prisma/client";
import {
  requireOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { caseStudyService } from "@/services/case-study.service";

const patchSchema = z.object({
  clientType: z.string().min(1).max(200).optional(),
  problem: z.string().min(1).max(5000).optional(),
  whatBuilt: z.string().min(1).max(5000).optional(),
  result: z.string().min(1).max(5000).optional(),
  status: z.nativeEnum(OfferStatus).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    await requireOrgPermission("business_brain.manage");
    const user = await requireOrganizationContext();
    const { id } = await ctx.params;
    const input = patchSchema.parse(await request.json());
    const row = await caseStudyService.update(user.organizationId, id, input);
    return NextResponse.json(apiSuccess(row));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    await requireOrgPermission("business_brain.manage");
    const user = await requireOrganizationContext();
    const { id } = await ctx.params;
    const row = await caseStudyService.archive(user.organizationId, id);
    return NextResponse.json(apiSuccess(row));
  } catch (error) {
    return handleApiError(error);
  }
}
