import { NextResponse } from "next/server";
import { automationService } from "@/services/automation.service";
import { requirePermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ leadId: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const user = await requirePermission("ai:use");
    const { leadId } = await params;
    const result = await automationService.runPipeline(leadId, user.id);
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const user = await requirePermission("ai:use");
    const { leadId } = await params;
    const result = await automationService.unlockLead(leadId, user.id);
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
