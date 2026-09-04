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
    const actions = await agentService.listPendingApprovals(
      user.organizationId
    );
    return NextResponse.json(apiSuccess(actions));
  } catch (error) {
    return handleApiError(error);
  }
}

const decideSchema = z.object({
  actionId: z.string().uuid(),
  decision: z.enum(["approve", "deny"]),
});

export async function POST(request: NextRequest) {
  try {
    await requireOrgPermission("agent.approve");
    const user = await requireOrganizationContext();
    const body = decideSchema.parse(await request.json());
    const action = await agentService.approveAction(
      user.organizationId,
      body.actionId,
      user.id,
      body.decision
    );
    return NextResponse.json(apiSuccess(action));
  } catch (error) {
    return handleApiError(error);
  }
}
