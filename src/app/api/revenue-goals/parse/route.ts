import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revenueGoalService } from "@/services/revenue-goal.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const parseSchema = z.object({
  prompt: z.string().min(10).max(5000),
});

const createFromSchema = z.object({
  prompt: z.string().min(10).max(5000),
  strategy: z.object({
    name: z.string(),
    targetRevenue: z.number().positive(),
    currency: z.string(),
    timeframe: z.object({
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      label: z.string(),
    }),
    estimatedDealCount: z.number().nullable(),
    averageDealValue: z.number().nullable(),
    icp: z.object({
      name: z.string(),
      industries: z.array(z.string()),
      regions: z.array(z.string()),
      countries: z.array(z.string()),
      companySizes: z.array(z.string()),
      decisionMakerTitles: z.array(z.string()),
    }),
    service: z.string().nullable(),
    signals: z.array(z.string()),
    channels: z.array(z.string()),
    summary: z.string(),
  }),
  createIcp: z.boolean().optional(),
  activate: z.boolean().optional(),
});

/** AI parse natural language → editable strategy (does not activate) */
export async function POST(request: NextRequest) {
  try {
    await requireOrgPermission("revenue_goals.manage");
    const user = await requireOrganizationContext();
    const body = await request.json();

    if (body?.strategy) {
      const input = createFromSchema.parse(body);
      const result = await revenueGoalService.createFromStrategy(
        user.organizationId,
        user.id,
        input.strategy,
        input.prompt,
        { createIcp: input.createIcp, activate: input.activate }
      );
      return NextResponse.json(apiSuccess(result), { status: 201 });
    }

    const { prompt } = parseSchema.parse(body);
    const strategy = await revenueGoalService.parseGoalPrompt(
      user.organizationId,
      user.id,
      prompt
    );
    return NextResponse.json(apiSuccess({ strategy, prompt }));
  } catch (error) {
    return handleApiError(error);
  }
}
