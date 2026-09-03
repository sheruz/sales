import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { emailAccountService } from "@/services/email-account.service";
import { userIntegrationService } from "@/services/user-integration.service";
import { requirePermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const smtpSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().max(200).optional(),
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().min(1).max(65535),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().min(1),
  smtpPassword: z.string().min(1),
  fromName: z.string().optional(),
  fromEmail: z.string().email(),
  dailyLimit: z.coerce.number().min(1).max(1000).optional(),
});

export async function GET() {
  try {
    await requirePermission("integrations:manage");
    const user = await requireOrganizationContext();
    const accounts = await emailAccountService.list(
      user.organizationId,
      user.id
    );
    return NextResponse.json(
      apiSuccess(accounts.map((a) => emailAccountService.sanitize(a)))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("integrations:manage");
    const user = await requireOrganizationContext();
    const input = smtpSchema.parse(await request.json());

    // Keep BYOK integration catalog in sync
    await userIntegrationService.saveEmailSmtp(
      user.organizationId,
      user.id,
      {
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpSecure: input.smtpSecure,
        smtpUser: input.smtpUser,
        smtpPassword: input.smtpPassword,
        fromName: input.fromName ?? input.displayName,
        fromEmail: input.fromEmail,
      }
    );

    const account = await emailAccountService.upsertSmtp(
      user.organizationId,
      user.id,
      {
        email: input.email ?? input.fromEmail,
        displayName: input.displayName ?? input.fromName,
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpSecure: input.smtpSecure,
        smtpUser: input.smtpUser,
        smtpPassword: input.smtpPassword,
        dailyLimit: input.dailyLimit,
      }
    );

    return NextResponse.json(
      apiSuccess(emailAccountService.sanitize(account)),
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
