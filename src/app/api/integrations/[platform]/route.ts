import { NextResponse } from "next/server";
import { IntegrationPlatform } from "@prisma/client";
import { userIntegrationService } from "@/services/user-integration.service";
import { requirePermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const PLATFORM_MAP: Record<string, IntegrationPlatform> = {
  openai: IntegrationPlatform.OPENAI,
  anthropic: IntegrationPlatform.ANTHROPIC,
  email: IntegrationPlatform.EMAIL_SMTP,
  linkedin: IntegrationPlatform.LINKEDIN,
};

interface RouteParams {
  params: Promise<{ platform: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const user = await requirePermission("integrations:manage");
    const { platform } = await params;
    const mapped = PLATFORM_MAP[platform.toLowerCase()];
    if (!mapped) {
      return NextResponse.json({ success: false, error: { message: "Unknown platform" } }, { status: 400 });
    }
    await userIntegrationService.disconnect(user.id, mapped);
    return NextResponse.json(apiSuccess({ disconnected: true }));
  } catch (error) {
    return handleApiError(error);
  }
}
