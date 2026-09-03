import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { userIntegrationService } from "@/services/user-integration.service";
import { requirePermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    await requirePermission("integrations:manage");
    const user = await requireOrganizationContext();
    const data = await userIntegrationService.listForUser(
      user.organizationId,
      user.id
    );
    return NextResponse.json(apiSuccess(data));
  } catch (error) {
    return handleApiError(error);
  }
}

const outreachSchema = z.object({
  activeAiProvider: z.enum(["OPENAI", "ANTHROPIC"]).optional(),
  economyModel: z.string().max(100).optional(),
  qualityModel: z.string().max(100).optional(),
  enabledChannels: z.array(z.enum(["email", "linkedin"])).optional(),
  discoveryMode: z.enum(["job_posts", "linkedin"]).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    await requirePermission("integrations:manage");
    const user = await requireOrganizationContext();
    const body = outreachSchema.parse(await request.json());
    const settings = await userIntegrationService.updateOutreachSettings(
      user.organizationId,
      user.id,
      body
    );
    return NextResponse.json(apiSuccess(settings));
  } catch (error) {
    return handleApiError(error);
  }
}
