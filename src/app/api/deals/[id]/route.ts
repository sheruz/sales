import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DealStage } from "@prisma/client";
import { dealService } from "@/services/deal.service";
import {
  requireOrgPermission,
  requireAnyOrgPermission,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireAnyOrgPermission([
      "deals.manage",
      "opportunities.view",
    ]);
    const { id } = await params;
    const deal = await dealService.getById(user.organizationId, id);
    return NextResponse.json(apiSuccess(deal));
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  stage: z.nativeEnum(DealStage).optional(),
  lostReason: z.string().max(2000).optional(),
  wonReason: z.string().max(2000).optional(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await requireOrgPermission("deals.manage");
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    if (body.stage) {
      const deal = await dealService.updateStage(
        user.organizationId,
        id,
        body.stage,
        {
          lostReason: body.lostReason,
          wonReason: body.wonReason,
          actorId: user.id,
        }
      );
      return NextResponse.json(apiSuccess(deal));
    }
    return NextResponse.json(apiSuccess(await dealService.getById(user.organizationId, id)));
  } catch (error) {
    return handleApiError(error);
  }
}
