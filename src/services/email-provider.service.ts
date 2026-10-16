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
  return Buffer.from(raw, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function hasNonAscii(value: string): boolean {
  return /[^\x00-\x7F]/.test(value);
}

/**
 * RFC 2047 encoded-word for header values (Subject, display-name, etc.).
 * Without this, Gmail/raw MIME shows mojibake like Ã¢Â€Â” for an em dash.
 */
export function encodeRfc2047Header(value: string): string {
  if (!hasNonAscii(value)) return value;
  // Split into ≤60-octet chunks so each encoded-word stays under ~75 chars.
  const bytes = Buffer.from(value, "utf8");
  const words: string[] = [];
  const chunkSize = 45; // 45 raw bytes → 60 base64 chars
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    words.push(`=?UTF-8?B?${slice.toString("base64")}?=`);
  }
  return words.join(" ");
}

/** Encode "Name <email@x>" From/To headers when the display name is non-ASCII. */
export function encodeAddressHeader(value: string): string {
  const m = value.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (!m) return value;
  const name = m[1].trim().replace(/^"|"$/g, "");
  const email = m[2].trim();
  if (!name) return `<${email}>`;
  if (!hasNonAscii(name)) {
    return `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}" <${email}>`;
  }
  return `${encodeRfc2047Header(name)} <${email}>`;
}

function encodeMimeBody(content: string): {
  transferEncoding: string;
  body: string;
} {
  if (!hasNonAscii(content)) {
    return { transferEncoding: "7bit", body: content };
  }
  const b64 = Buffer.from(content, "utf8")
    .toString("base64")
    .replace(/(.{76})/g, "$1\r\n");
  return { transferEncoding: "base64", body: b64 };
}

/** Build RFC 2046 multipart/alternative (text + html). */
export function buildMultipartAlternative(params: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
  inReplyTo?: string | null;
  references?: string | null;
}): string {
  const boundary = `delvix_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const extra: string[] = [];
  if (params.headers) {
    for (const [k, v] of Object.entries(params.headers)) {
      if (v) extra.push(`${k}: ${encodeRfc2047Header(v)}`);
    }
  }
  if (params.inReplyTo) {
    const v = params.inReplyTo.startsWith("<")
      ? params.inReplyTo
      : `<${params.inReplyTo}>`;
    if (!extra.some((h) => h.toLowerCase().startsWith("in-reply-to:"))) {
      extra.push(`In-Reply-To: ${v}`);
    }
  }
  if (params.references) {
    const v = params.references.startsWith("<")
      ? params.references
      : `<${params.references}>`;
    if (!extra.some((h) => h.toLowerCase().startsWith("references:"))) {
      extra.push(`References: ${v}`);
    }
  }

  const textPart = encodeMimeBody(params.text);
  const htmlPart = encodeMimeBody(params.html);

  return [
    `From: ${encodeAddressHeader(params.from)}`,
    `To: ${encodeAddressHeader(params.to)}`,
    `Subject: ${encodeRfc2047Header(params.subject)}`,
    "MIME-Version: 1.0",
    ...extra,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    `Content-Transfer-Encoding: ${textPart.transferEncoding}`,
    "",
    textPart.body,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    `Content-Transfer-Encoding: ${htmlPart.transferEncoding}`,
    "",
    htmlPart.body,
    "",
    `--${boundary}--`,
  ].join("\r\n");
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

  async send(
    account: EmailAccount,
    params: {
      to: string;
      subject: string;
      text: string;
      html?: string;
      headers?: Record<string, string>;
      inReplyTo?: string | null;
      references?: string | null;
    }
  ): Promise<ProviderSendResult> {
    const html = params.html ?? params.text.replace(/\n/g, "<br>");
    const text = params.text;

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
        {
          to: params.to,
          subject: params.subject,
          text,
          html,
          headers: params.headers,
          inReplyTo: params.inReplyTo,
          references: params.references,
        }
      );
      return { providerMessageId: result.messageId };
    }

    if (account.provider === EmailProvider.GMAIL) {
      const token = await this.ensureFreshAccessToken(account);
      const from = `${account.displayName || account.email} <${account.email}>`;
      const raw = buildMultipartAlternative({
        from,
        to: params.to,
        subject: params.subject,
        text,
        html,
        headers: params.headers,
        inReplyTo: params.inReplyTo,
        references: params.references,
      });

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
      const internetHeaders: Array<{ name: string; value: string }> = [];
      if (params.headers) {
        for (const [name, value] of Object.entries(params.headers)) {
          if (value) internetHeaders.push({ name, value });
        }
      }
      if (params.inReplyTo) {
        internetHeaders.push({
          name: "In-Reply-To",
          value: params.inReplyTo.startsWith("<")
            ? params.inReplyTo
            : `<${params.inReplyTo}>`,
        });
      }
      if (params.references) {
        internetHeaders.push({
          name: "References",
          value: params.references.startsWith("<")
            ? params.references
            : `<${params.references}>`,
        });
      }

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
              content: html,
            },
            toRecipients: [{ emailAddress: { address: params.to } }],
            internetMessageHeaders: internetHeaders.length
              ? internetHeaders
              : undefined,
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
