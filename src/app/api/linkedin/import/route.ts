import { NextRequest, NextResponse } from "next/server";
import { linkedInService } from "@/services/linkedin.service";
import { automationService } from "@/services/automation.service";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { z } from "zod";

const importSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(50),
  campaignId: z.string().uuid().optional(),
  autoStartAutomation: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireOrgPermission("campaigns.manage");
    const body = await request.json();
    const input = importSchema.parse(body);

    const leadIds: string[] = [];
    const errors: string[] = [];

    for (const url of input.urls) {
      try {
        const leadId = await linkedInService.importFromProfileUrl(
          user.organizationId,
          url,
          input.campaignId,
          user.id
        );
        leadIds.push(leadId);
      } catch (err) {
        errors.push(`${url}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    if (input.autoStartAutomation && leadIds.length > 0) {
      await automationService.startBatch(
        user.organizationId,
        leadIds,
        input.campaignId,
        user.id
      );
      for (const leadId of leadIds) {
        automationService
          .runPipeline(user.organizationId, leadId, user.id)
          .catch(console.error);
      }
    }

    return NextResponse.json(apiSuccess({ leadIds, errors }), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
