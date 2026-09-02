import { env } from "@/lib/config/env";
import { sendEmailWithConfig, type SmtpConfig } from "@/lib/email/send-mail";
import { userIntegrationService } from "@/services/user-integration.service";

export type { SendEmailParams } from "@/lib/email/send-mail";

export async function sendEmailForUser(
  userId: string | undefined,
  params: { to: string; subject: string; text: string; html?: string }
) {
  if (userId) {
    const userConfig = await userIntegrationService.getEmailConfig(userId);
    if (userConfig) {
      return sendEmailWithConfig(userConfig, params);
    }
  }

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    throw new Error(
      "Email not configured. Add your SMTP settings in Settings → Integrations."
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

export async function isEmailConfiguredForUser(userId?: string): Promise<boolean> {
  if (userId) {
    return userIntegrationService.isEmailConfigured(userId);
  }
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
}
