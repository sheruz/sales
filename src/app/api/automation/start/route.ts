import { NextRequest, NextResponse } from "next/server";
import { automationService } from "@/services/automation.service";
import { startAutomationSchema } from "@/lib/validations/automation";
import { requirePermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("ai:use");
    const body = await request.json();
    const input = startAutomationSchema.parse(body);

    const results = await automationService.startBatch(
      input.leadIds,
      input.campaignId,
      user.id,
      input.channels
    );

    // Trigger pipeline processing
    for (const r of results) {
      if (r.status === "queued") {
        automationService.runPipeline(r.leadId, user.id).catch(console.error);
      }
    }

    return NextResponse.json(apiSuccess(results), { status: 202 });
  } catch (error) {
    return handleApiError(error);
  }
}
