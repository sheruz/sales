import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { IntegrationPlatform } from "@prisma/client";
import { userIntegrationService } from "@/services/user-integration.service";
import { requirePermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    const user = await requirePermission("integrations:manage");
    const data = await userIntegrationService.listForUser(user.id);
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
    const user = await requirePermission("integrations:manage");
    const body = outreachSchema.parse(await request.json());
    const settings = await userIntegrationService.updateOutreachSettings(user.id, body);
    return NextResponse.json(apiSuccess(settings));
  } catch (error) {
    return handleApiError(error);
  }
}
