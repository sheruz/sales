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

const createSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.coerce.number().min(0),
  currency: z.string().max(8).optional(),
  deliveryDays: z.coerce.number().int().min(1).max(365),
  includes: z.string().min(1).max(5000),
  findingTypes: z.array(z.enum(STARTER_FINDING_TYPES)).min(1),
  status: z.nativeEnum(OfferStatus).optional(),
});

export async function GET() {
  try {
    await requireOrgPermission("organization.view");
    const user = await requireOrganizationContext();
    const rows = await starterOfferService.list(user.organizationId, true);
    return NextResponse.json(apiSuccess(rows));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOrgPermission("business_brain.manage");
    const user = await requireOrganizationContext();
    const input = createSchema.parse(await request.json());
    const row = await starterOfferService.create(user.organizationId, input);
    return NextResponse.json(apiSuccess(row), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
