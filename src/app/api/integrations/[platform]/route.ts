import { NextResponse } from "next/server";
import { IntegrationPlatform } from "@prisma/client";
import { userIntegrationService } from "@/services/user-integration.service";
import { emailAccountService } from "@/services/email-account.service";
import { requireOrgPermission } from "@/lib/auth/api-auth";
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
    const user = await requireOrgPermission("integrations.manage");
    const { platform } = await params;
    const mapped = PLATFORM_MAP[platform.toLowerCase()];
    if (!mapped) {
      return NextResponse.json(
        { success: false, error: { message: "Unknown platform" } },
        { status: 400 }
      );
    }
    await userIntegrationService.disconnect(
      user.organizationId,
      user.id,
      mapped
    );
    // Keep EmailAccount seats in sync when SMTP is torn down via the generic route.
    if (mapped === IntegrationPlatform.EMAIL_SMTP) {
      const accounts = await emailAccountService.list(
        user.organizationId,
        user.id
      );
      for (const account of accounts.filter((a) => a.provider === "SMTP")) {
        await emailAccountService.disconnect(user.organizationId, account.id);
      }
    }
    return NextResponse.json(apiSuccess({ disconnected: true }));
  } catch (error) {
    return handleApiError(error);
  }
}
