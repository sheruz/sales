import { NextRequest, NextResponse } from "next/server";
import { aiResearchService } from "@/services/ai-research.service";
import { requirePermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ leadId: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("ai:use");
    const { leadId } = await params;
    const result = await aiResearchService.researchLead(leadId, user.id);
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
