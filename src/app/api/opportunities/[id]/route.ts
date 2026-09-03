import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OpportunityStage, OpportunityStatus } from "@prisma/client";
import { opportunityService } from "@/services/opportunity.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("opportunities.view");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const opportunity = await opportunityService.getById(
      user.organizationId,
      id
    );
    return NextResponse.json(apiSuccess(opportunity));
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  stage: z.nativeEnum(OpportunityStage).optional(),
  status: z.nativeEnum(OpportunityStatus).optional(),
  ownerId: z.string().uuid().nullable().optional(),
  recommendedAction: z.string().max(2000).nullable().optional(),
  whyNow: z.string().max(2000).nullable().optional(),
  likelyProblem: z.string().max(2000).nullable().optional(),
  recommendedServiceId: z.string().uuid().nullable().optional(),
  nextActionAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("opportunities.update");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const opportunity = await opportunityService.update(
      user.organizationId,
      id,
      {
        ...body,
        nextActionAt:
          body.nextActionAt === undefined
            ? undefined
            : body.nextActionAt
              ? new Date(body.nextActionAt)
              : null,
      },
      user.id
    );
    return NextResponse.json(apiSuccess(opportunity));
  } catch (error) {
    return handleApiError(error);
  }
}
