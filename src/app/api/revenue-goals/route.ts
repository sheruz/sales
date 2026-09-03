import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RevenueGoalStatus } from "@prisma/client";
import { revenueGoalService } from "@/services/revenue-goal.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const goalSchema = z.object({
  name: z.string().min(1).max(200),
  targetRevenue: z.coerce.number().positive(),
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

export async function GET() {
  try {
    await requireOrgPermission("revenue.view");
    const user = await requireOrganizationContext();
    const goals = await revenueGoalService.list(user.organizationId);
    return NextResponse.json(apiSuccess(goals));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOrgPermission("revenue_goals.manage");
    const user = await requireOrganizationContext();
    const body = goalSchema.parse(await request.json());
    const goal = await revenueGoalService.create(user.organizationId, body);
    return NextResponse.json(apiSuccess(goal), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
