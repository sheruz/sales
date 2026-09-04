import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DealStage } from "@prisma/client";
import { dealService } from "@/services/deal.service";
import { requirePermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("deals:read");
    const user = await requireOrganizationContext();
    const stage = request.nextUrl.searchParams.get("stage") as DealStage | null;
    const board = request.nextUrl.searchParams.get("board") === "1";
    if (board) {
      const data = await dealService.pipelineBoard(user.organizationId);
      return NextResponse.json(apiSuccess(data));
    }
    const deals = await dealService.list(user.organizationId, {
      stage: stage ?? undefined,
    });
    return NextResponse.json(apiSuccess(deals));
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  opportunityId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  primaryContactId: z.string().uuid().optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
  estimatedValue: z.coerce.number().min(0),
  currency: z.string().max(8).optional(),
  stage: z.nativeEnum(DealStage).optional(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    await requirePermission("deals:write");
    const user = await requireOrganizationContext();
    const input = createSchema.parse(await request.json());
    const deal = await dealService.create(user.organizationId, input, user.id);
    return NextResponse.json(apiSuccess(deal), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
