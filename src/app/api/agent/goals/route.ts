import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { agentService } from "@/services/agent.service";
import {
  requireOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    await requireOrgPermission("agent.view");
    const user = await requireOrganizationContext();
    const goals = await agentService.listGoals(user.organizationId);
    return NextResponse.json(apiSuccess(goals));
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  revenueGoalId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  objective: z.string().max(5000).optional(),
  allowedChannels: z.array(z.string()).optional(),
  allowedActions: z.array(z.string()).optional(),
  maxDailyActions: z.coerce.number().int().positive().max(500).optional(),
  maxDailySpend: z.coerce.number().min(0).optional(),
  activate: z.boolean().optional(),
  constraints: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireOrgPermission("agent.manage");
    const user = await requireOrganizationContext();
    const body = createSchema.parse(await request.json());
    const goal = await agentService.createGoal(
      user.organizationId,
      user.id,
      body
    );
    return NextResponse.json(apiSuccess(goal), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
