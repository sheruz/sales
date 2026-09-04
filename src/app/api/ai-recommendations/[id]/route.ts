import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AiRecommendationStatus } from "@prisma/client";
import { aiRecommendationService } from "@/services/ai-recommendation.service";
import { requirePermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface Params {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  status: z.nativeEnum(AiRecommendationStatus),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requirePermission("ai:use");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const row = await aiRecommendationService.updateStatus(
      user.organizationId,
      id,
      body.status
    );
    return NextResponse.json(apiSuccess(row));
  } catch (error) {
    return handleApiError(error);
  }
}
