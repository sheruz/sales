/**
 * B5a: Platform transactional email transport.
 * Prefer Resend (DB API key); fall back to env SMTP. Never use tenant mailboxes.
 */

import dns from "node:dns/promises";
import { Resend } from "resend";
import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { logger } from "@/lib/logger";
import { sendEmailWithConfig, type SmtpConfig } from "@/lib/email/send-mail";
import {
  encryptCredentials,
  decryptCredentials,
  maskSecret,
} from "@/lib/integrations/credentials";
import { ValidationError } from "@/lib/api/response";
import { organizationService } from "@/services/organization.service";

export type PlatformEmailProvider = "RESEND" | "SMTP";

export type PlatformEmailTransportPublic = {
  provider: PlatformEmailProvider;
  fromEmail: string | null;
  fromName: string | null;
  replyTo: string | null;
  domain: string | null;
  resendConfigured: boolean;
  resendHint: string | null;
  smtpConfigured: boolean;
};

export type DnsCheckResult = {
  domain: string;
  spf: { ok: boolean; records: string[] };
  dkim: { ok: boolean; selectorsChecked: string[]; records: string[] };
  mx: { ok: boolean; records: string[] };
};

function envSmtp(): SmtpConfig | null {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) return null;
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    fromName: env.SMTP_FROM_NAME || "Platform",
    fromEmail: env.SMTP_FROM_EMAIL ?? env.SMTP_USER,
  };
}

export class PlatformEmailTransportService {
  async getPublic(): Promise<PlatformEmailTransportPublic> {
    const row = await prisma.paymentSettings.findUnique({
      where: { id: "default" },
    });
    const smtp = envSmtp();
    let resendHint: string | null = null;
    if (row?.platformEmailResendKeyEnc) {
      try {
        const creds = decryptCredentials(row.platformEmailResendKeyEnc);
        if (creds.apiKey) resendHint = maskSecret(creds.apiKey, 4);
      } catch {
        resendHint = "••••configured";
      }
    }
    return {
      provider: (row?.platformEmailProvider === "RESEND"
        ? "RESEND"
        : "SMTP") as PlatformEmailProvider,
      fromEmail: row?.platformEmailFromEmail ?? smtp?.fromEmail ?? null,
      fromName: row?.platformEmailFromName ?? smtp?.fromName ?? null,
      replyTo: row?.platformEmailReplyTo ?? null,
      domain: row?.platformEmailDomain ?? null,
      resendConfigured: Boolean(row?.platformEmailResendKeyEnc),
      resendHint,
      smtpConfigured: Boolean(smtp),
    };
  }

  async update(
    input: {
      provider?: PlatformEmailProvider;
      fromEmail?: string | null;
      fromName?: string | null;
      replyTo?: string | null;
      domain?: string | null;
      resendApiKey?: string | null;
    },
    actorUserId: string
  ) {
    await prisma.paymentSettings.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
    });
    const before = await this.getPublic();
    const data: Record<string, unknown> = {};
    if (input.provider) data.platformEmailProvider = input.provider;
    if (input.fromEmail !== undefined)
      data.platformEmailFromEmail = input.fromEmail?.trim() || null;
    if (input.fromName !== undefined)
      data.platformEmailFromName = input.fromName?.trim() || null;
    if (input.replyTo !== undefined)
      data.platformEmailReplyTo = input.replyTo?.trim() || null;
    if (input.domain !== undefined)
      data.platformEmailDomain = input.domain?.trim().toLowerCase() || null;
    if (input.resendApiKey !== undefined) {
      const key = input.resendApiKey?.trim();
      if (!key) {
        data.platformEmailResendKeyEnc = null;
      } else {
        data.platformEmailResendKeyEnc = encryptCredentials({ apiKey: key });
      }
    }
    await prisma.paymentSettings.update({
      where: { id: "default" },
      data,
    });
    const after = await this.getPublic();
    await organizationService.writePlatformAudit({
      actorUserId,
      action: "platform_email.transport_updated",
      targetType: "payment_settings",
      targetId: "default",
      before: {
        provider: before.provider,
        fromEmail: before.fromEmail,
        domain: before.domain,
        resendConfigured: before.resendConfigured,
      },
      after: {
        provider: after.provider,
        fromEmail: after.fromEmail,
        domain: after.domain,
        resendConfigured: after.resendConfigured,
      },
    });
    return after;
  }

  async checkDns(domain?: string | null): Promise<DnsCheckResult> {
    const settings = await this.getPublic();
    const d = (domain || settings.domain || "").trim().toLowerCase();
    if (!d) throw new ValidationError("Domain required for DNS check");

    const spfRecords: string[] = [];
    let spfOk = false;
    try {
      const txt = await dns.resolveTxt(d);
      for (const parts of txt) {
        const joined = parts.join("");
        if (/v=spf1/i.test(joined)) {
          spfRecords.push(joined);
          spfOk = true;
        }
      }
    } catch {
      /* no TXT */
    }

    const selectors = ["resend", "default", "s1", "s2", "google", "selector1"];
    const dkimRecords: string[] = [];
    const foundSelectors: string[] = [];
    for (const sel of selectors) {
      try {
        const name = `${sel}._domainkey.${d}`;
        const txt = await dns.resolveTxt(name);
        for (const parts of txt) {
          const joined = parts.join("");
          if (/v=DKIM1|p=/i.test(joined)) {
            dkimRecords.push(`${sel}: ${joined.slice(0, 80)}…`);
            foundSelectors.push(sel);
          }
        }
      } catch {
        /* skip */
      }
    }

    const mxRecords: string[] = [];
    let mxOk = false;
    try {
      const mx = await dns.resolveMx(d);
      for (const m of mx) {
        mxRecords.push(`${m.exchange} (pri ${m.priority})`);
        mxOk = true;
      }
    } catch {
      /* no MX */
    }

    return {
      domain: d,
      spf: { ok: spfOk, records: spfRecords },
      dkim: {
        ok: foundSelectors.length > 0,
        selectorsChecked: selectors,
        records: dkimRecords,
      },
      mx: { ok: mxOk, records: mxRecords },
    };
  }

  private async resolveFrom(overrides?: {
    fromName?: string;
    fromEmail?: string;
  }): Promise<{
    fromName: string;
    fromEmail: string;
    replyTo: string | null;
    provider: PlatformEmailProvider;
    resendKey: string | null;
  }> {
    const row = await prisma.paymentSettings.findUnique({
      where: { id: "default" },
    });
    const smtp = envSmtp();
    let resendKey: string | null = null;
    if (row?.platformEmailResendKeyEnc) {
      try {
        resendKey =
          decryptCredentials(row.platformEmailResendKeyEnc).apiKey || null;
      } catch {
        resendKey = null;
      }
    }
    const preferResend =
      row?.platformEmailProvider === "RESEND" && Boolean(resendKey);
    const fromEmail =
      overrides?.fromEmail ||
      row?.platformEmailFromEmail ||
      smtp?.fromEmail ||
      "";
    const fromName =
      overrides?.fromName ||
      row?.platformEmailFromName ||
      smtp?.fromName ||
      "Platform";
    return {
      fromName,
      fromEmail,
      replyTo: row?.platformEmailReplyTo ?? null,
      provider: preferResend ? "RESEND" : "SMTP",
      resendKey: preferResend ? resendKey : null,
    };
  }

  /**
   * Send one platform transactional email.
   * Tries Resend when configured; otherwise SMTP. Never tenant SMTP.
   */
  async send(input: {
    to: string;
    subject: string;
    html: string;
    text: string;
    fromName?: string;
  }): Promise<{ provider: PlatformEmailProvider; messageId: string }> {
    const resolved = await this.resolveFrom({ fromName: input.fromName });
    if (!resolved.fromEmail) {
      throw new Error(
        "Platform email from-address not configured (Payments → Platform email or SMTP_FROM_EMAIL)"
      );
    }

    if (resolved.provider === "RESEND" && resolved.resendKey) {
      try {
        const resend = new Resend(resolved.resendKey);
        const result = await resend.emails.send({
          from: `${resolved.fromName} <${resolved.fromEmail}>`,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
          ...(resolved.replyTo ? { replyTo: resolved.replyTo } : {}),
        });
        if (result.error) {
          throw new Error(result.error.message || "Resend error");
        }
        return {
          provider: "RESEND",
          messageId: result.data?.id || `resend-${Date.now()}`,
        };
      } catch (err) {
        logger.warn("Resend send failed; falling back to SMTP", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const smtp = envSmtp();
    if (!smtp) {
      throw new Error(
        "No platform email transport available (configure Resend or SMTP)"
      );
    }
    const cfg: SmtpConfig = {
      ...smtp,
      fromName: resolved.fromName || smtp.fromName,
      fromEmail: resolved.fromEmail || smtp.fromEmail,
    };
    const info = await sendEmailWithConfig(cfg, {
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      ...(resolved.replyTo
        ? { headers: { "Reply-To": resolved.replyTo } }
        : {}),
    });
    return { provider: "SMTP", messageId: info.messageId };
  }
}

export const platformEmailTransportService =
  new PlatformEmailTransportService();
