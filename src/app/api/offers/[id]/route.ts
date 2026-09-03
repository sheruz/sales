import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OfferStatus } from "@prisma/client";
import { offerService } from "@/services/offer.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface Params {
  params: Promise<{ id: string }>;
}

const updateSchema = z.object({
  serviceId: z.string().uuid().optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  problem: z.string().max(5000).optional().nullable(),
  solution: z.string().max(5000).optional().nullable(),
  outcome: z.string().max(5000).optional().nullable(),
  pricingModel: z.string().max(100).optional().nullable(),
  minValue: z.coerce.number().optional().nullable(),
  maxValue: z.coerce.number().optional().nullable(),
  currency: z.string().max(8).optional(),
  deliveryTime: z.string().max(200).optional().nullable(),
  status: z.nativeEnum(OfferStatus).optional(),
});

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("organization.view");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const offer = await offerService.getById(user.organizationId, id);
    return NextResponse.json(apiSuccess(offer));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("business_brain.manage");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const input = updateSchema.parse(await request.json());
    const offer = await offerService.update(user.organizationId, id, input);
    return NextResponse.json(apiSuccess(offer));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("business_brain.manage");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const offer = await offerService.archive(user.organizationId, id);
    return NextResponse.json(apiSuccess(offer));
  } catch (error) {
    return handleApiError(error);
  }
}
