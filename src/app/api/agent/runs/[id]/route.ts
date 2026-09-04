import { NextRequest, NextResponse } from "next/server";
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

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("agent.view");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const run = await agentService.getRun(user.organizationId, id);
    return NextResponse.json(apiSuccess(run));
  } catch (error) {
    return handleApiError(error);
  }
}
