import { env } from "@/lib/config/env";
import { sendEmailWithConfig, type SmtpConfig } from "@/lib/email/send-mail";
import { userIntegrationService } from "@/services/user-integration.service";
import { emailAccountService } from "@/services/email-account.service";
import { emailProviderService } from "@/services/email-provider.service";

export type { SendEmailParams } from "@/lib/email/send-mail";

export async function sendEmailForUser(
  organizationId: string | undefined,
  userId: string | undefined,
  params: { to: string; subject: string; text: string; html?: string }
) {
  if (organizationId && userId) {
    const account = await emailAccountService.getDefaultForUser(
      organizationId,
      userId
    );
    if (account) {
      return emailProviderService.send(account, {
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
    }

    const userConfig = await userIntegrationService.getEmailConfig(
      organizationId,
      userId
    );
    if (userConfig) {
      return sendEmailWithConfig(userConfig, params);
    }
    throw new Error(
      "Email not configured. Go to Settings → Integrations and connect Gmail, Outlook, or SMTP."
    );
  }

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    throw new Error(
      "Email not configured. Connect SMTP in Settings → Integrations."
    );
  }

  const platformConfig: SmtpConfig = {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    fromName: env.SMTP_FROM_NAME,
    fromEmail: env.SMTP_FROM_EMAIL ?? env.SMTP_USER,
  };

  return sendEmailWithConfig(platformConfig, params);
}

export async function isEmailConfiguredForUser(
  organizationId?: string,
  userId?: string
): Promise<boolean> {
  if (organizationId && userId) {
    const account = await emailAccountService.getDefaultForUser(
      organizationId,
      userId
    );
    if (account) return true;
    return userIntegrationService.isEmailConfigured(organizationId, userId);
  }
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
}
