import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { userIntegrationService } from "@/services/user-integration.service";
import { requirePermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const schema = z.object({
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().min(1).max(65535),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().min(1),
  smtpPassword: z.string().min(1),
  fromName: z.string().optional(),
  fromEmail: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    await requirePermission("integrations:manage");
    const user = await requireOrganizationContext();
    const input = schema.parse(await request.json());
    const integration = await userIntegrationService.saveEmailSmtp(
      user.organizationId,
      user.id,
      input
    );
    return NextResponse.json(apiSuccess(integration));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    await requirePermission("integrations:manage");
    const user = await requireOrganizationContext();
    await userIntegrationService.disconnect(
      user.organizationId,
      user.id,
      "EMAIL_SMTP"
    );
    return NextResponse.json(apiSuccess({ disconnected: true }));
  } catch (error) {
    return handleApiError(error);
  }
}
