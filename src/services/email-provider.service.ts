import { EmailProvider, type EmailAccount } from "@prisma/client";
import { encrypt } from "@/lib/crypto/encrypt";
import { sendEmailWithConfig } from "@/lib/email/send-mail";
import { emailAccountService } from "@/services/email-account.service";
import { gmailOAuthService } from "@/services/gmail-oauth.service";
import { outlookOAuthService } from "@/services/outlook-oauth.service";
import prisma from "@/lib/db/prisma";

export type ProviderSendResult = {
  providerMessageId: string;
  threadId?: string | null;
};

function toBase64Url(raw: string): string {
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export class EmailProviderService {
  async ensureFreshAccessToken(account: EmailAccount): Promise<string> {
    const access = emailAccountService.getAccessToken(account);
    const refresh = emailAccountService.getRefreshToken(account);
    const expired =
      account.tokenExpiresAt &&
      account.tokenExpiresAt.getTime() < Date.now() + 60_000;

    if (access && !expired) return access;
    if (!refresh) {
      if (access) return access;
      throw new Error("No OAuth tokens available for email account");
    }

    if (account.provider === EmailProvider.GMAIL) {
      const refreshed = await gmailOAuthService.refreshAccessToken(refresh);
      await prisma.emailAccount.update({
        where: { id: account.id },
        data: {
          encryptedAccessToken: encrypt(refreshed.access_token),
          tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        },
      });
      return refreshed.access_token;
    }

    if (account.provider === EmailProvider.OUTLOOK) {
      const refreshed = await outlookOAuthService.refreshAccessToken(refresh);
      await prisma.emailAccount.update({
        where: { id: account.id },
        data: {
          encryptedAccessToken: encrypt(refreshed.access_token),
          encryptedRefreshToken: refreshed.refresh_token
            ? encrypt(refreshed.refresh_token)
            : undefined,
          tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        },
      });
      return refreshed.access_token;
    }

    throw new Error("SMTP accounts do not use OAuth access tokens");
  }

  async send(account: EmailAccount, params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<ProviderSendResult> {
    if (account.provider === EmailProvider.SMTP) {
      const password = emailAccountService.getSmtpPassword(account);
      if (!account.smtpHost || !account.smtpUser || !password) {
        throw new Error("SMTP account is incomplete");
      }
      const result = await sendEmailWithConfig(
        {
          host: account.smtpHost,
          port: account.smtpPort ?? 587,
          secure: account.smtpSecure ?? false,
          user: account.smtpUser,
          password,
          fromName: account.displayName || account.email,
          fromEmail: account.email,
        },
        params
      );
      return { providerMessageId: result.messageId };
    }

    if (account.provider === EmailProvider.GMAIL) {
      const token = await this.ensureFreshAccessToken(account);
      const raw = [
        `From: ${account.displayName || account.email} <${account.email}>`,
        `To: ${params.to}`,
        `Subject: ${params.subject}`,
        "MIME-Version: 1.0",
        'Content-Type: text/html; charset="UTF-8"',
        "",
        params.html ?? params.text.replace(/\n/g, "<br>"),
      ].join("\r\n");

      const res = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw: toBase64Url(raw) }),
        }
      );
      if (!res.ok) {
        throw new Error(`Gmail send failed: ${await res.text()}`);
      }
      const data = (await res.json()) as { id: string; threadId?: string };
      return { providerMessageId: data.id, threadId: data.threadId };
    }

    if (account.provider === EmailProvider.OUTLOOK) {
      const token = await this.ensureFreshAccessToken(account);
      const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: params.subject,
            body: {
              contentType: "HTML",
              content: params.html ?? params.text.replace(/\n/g, "<br>"),
            },
            toRecipients: [
              { emailAddress: { address: params.to } },
            ],
          },
          saveToSentItems: true,
        }),
      });
      if (!res.ok) {
        throw new Error(`Outlook send failed: ${await res.text()}`);
      }
      return {
        providerMessageId: `outlook-sent-${Date.now()}`,
      };
    }

    throw new Error(`Unsupported email provider: ${account.provider}`);
  }
}

export const emailProviderService = new EmailProviderService();
