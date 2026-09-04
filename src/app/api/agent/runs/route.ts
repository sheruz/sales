import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { agentService } from "@/services/agent.service";
import {
  requireOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const runSchema = z.object({
  agentGoalId: z.string().uuid(),
  idempotencyKey: z.string().max(200).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireOrgPermission("agent.view");
    const user = await requireOrganizationContext();
    const agentGoalId =
      request.nextUrl.searchParams.get("agentGoalId") || undefined;
    const runs = await agentService.listRuns(
      user.organizationId,
      agentGoalId || undefined
    );
    return NextResponse.json(apiSuccess(runs));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOrgPermission("agent.manage");
    const user = await requireOrganizationContext();
    const body = runSchema.parse(await request.json());
    const run = await agentService.startRun(
      user.organizationId,
      body.agentGoalId,
      user.id,
      { idempotencyKey: body.idempotencyKey, triggeredBy: "USER" }
    );
    return NextResponse.json(apiSuccess(run), { status: 202 });
  } catch (error) {
    return handleApiError(error);
  }
}
