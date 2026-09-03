import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OfferStatus } from "@prisma/client";
import { offerService } from "@/services/offer.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const createSchema = z.object({
  serviceId: z.string().uuid(),
  name: z.string().min(1).max(200),
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

export async function GET(request: NextRequest) {
  try {
    await requireOrgPermission("organization.view");
    const user = await requireOrganizationContext();
    const includeArchived =
      request.nextUrl.searchParams.get("includeArchived") === "1";
    const offers = await offerService.list(user.organizationId, includeArchived);
    return NextResponse.json(apiSuccess(offers));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOrgPermission("business_brain.manage");
    const user = await requireOrganizationContext();
    const input = createSchema.parse(await request.json());
    const offer = await offerService.create(user.organizationId, input);
    return NextResponse.json(apiSuccess(offer), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
