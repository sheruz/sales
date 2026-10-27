import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OfferStatus } from "@prisma/client";
import {
  requireOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { STARTER_FINDING_TYPES } from "@/lib/pow/constants";
import { starterOfferService } from "@/services/starter-offer.service";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  price: z.coerce.number().min(0).optional(),
  currency: z.string().max(8).optional(),
  deliveryDays: z.coerce.number().int().min(1).max(365).optional(),
  includes: z.string().min(1).max(5000).optional(),
  findingTypes: z.array(z.enum(STARTER_FINDING_TYPES)).min(1).optional(),
  status: z.nativeEnum(OfferStatus).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    await requireOrgPermission("business_brain.manage");
    const user = await requireOrganizationContext();
    const { id } = await ctx.params;
    const input = patchSchema.parse(await request.json());
    const row = await starterOfferService.update(
      user.organizationId,
      id,
      input
    );
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
    const row = await starterOfferService.archive(user.organizationId, id);
    return NextResponse.json(apiSuccess(row));
  } catch (error) {
    return handleApiError(error);
  }
}
