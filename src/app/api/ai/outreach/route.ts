import { NextRequest, NextResponse } from "next/server";
import { aiOutreachService } from "@/services/ai-outreach.service";
import { generateOutreachSchema } from "@/lib/validations/automation";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "leads.update",
      "opportunities.update",
    ]);
    const body = await request.json();
    const input = generateOutreachSchema.parse(body);
    const result = await aiOutreachService.generateOutreach(
      user.organizationId,
      input.leadId,
      input.channel,
      user.id,
      input.campaignId
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
