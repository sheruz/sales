import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AgentGoalStatus } from "@prisma/client";
import { agentService } from "@/services/agent.service";
import {
  requireOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface Params {
  params: Promise<{ id: string }>;
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  objective: z.string().max(5000).optional(),
  allowedChannels: z.array(z.string()).optional(),
  allowedActions: z.array(z.string()).optional(),
  maxDailyActions: z.coerce.number().int().positive().max(500).optional(),
  maxDailySpend: z.coerce.number().min(0).optional(),
  status: z.nativeEnum(AgentGoalStatus).optional(),
  constraints: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("agent.view");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const goal = await agentService.getGoal(user.organizationId, id);
    return NextResponse.json(apiSuccess(goal));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("agent.manage");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const body = updateSchema.parse(await request.json());
    const goal = await agentService.updateGoal(user.organizationId, id, body);
    return NextResponse.json(apiSuccess(goal));
  } catch (error) {
    return handleApiError(error);
  }
}
