import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RevenueGoalStatus } from "@prisma/client";
import { revenueGoalService } from "@/services/revenue-goal.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface Params {
  params: Promise<{ id: string }>;
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  targetRevenue: z.coerce.number().positive().optional(),
  currency: z.string().max(8).optional(),
  targetDeals: z.coerce.number().int().positive().nullable().optional(),
  averageDealValue: z.coerce.number().positive().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  targetRegions: z.array(z.string()).optional(),
  targetIndustries: z.array(z.string()).optional(),
  targetCompanySizes: z.array(z.string()).optional(),
  targetServices: z.array(z.string()).optional(),
  preferredChannels: z.array(z.string()).optional(),
  strategyDraft: z.unknown().optional(),
  sourcePrompt: z.string().max(5000).nullable().optional(),
  status: z.nativeEnum(RevenueGoalStatus).optional(),
});

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("revenue.view");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const goal = await revenueGoalService.getById(user.organizationId, id);
    return NextResponse.json(apiSuccess(goal));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("revenue_goals.manage");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const body = updateSchema.parse(await request.json());
    const goal = await revenueGoalService.update(user.organizationId, id, body);
    return NextResponse.json(apiSuccess(goal));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("revenue_goals.manage");
    const user = await requireOrganizationContext();
    const { id } = await params;
    await revenueGoalService.delete(user.organizationId, id);
    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (error) {
    return handleApiError(error);
  }
}
