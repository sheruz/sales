/**
 * Branded HTML for platform → tenant emails (billing, invites, notices).
 * Uses Super Admin platform email branding (not tenant cold-outreach branding).
 */

import {
  asEmailBranding,
  brandingFileUrlFromPath,
  type EmailBranding,
} from "@/lib/email/branding";

export const PLATFORM_BRANDING_ORG_KEY = "platform";

function appBaseUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Platform → tenant mail. Prefer Super Admin platform email branding;
 * env SMTP_FROM_NAME only as last resort (never hard-code a brand string).
 */
export function resolvePlatformBrandingUrls(branding: EmailBranding) {
  const envFrom = (process.env.SMTP_FROM_NAME || "").trim();
  const company =
    branding.legalCompanyName.trim() || envFrom || "Platform";
  const sender =
    branding.senderName.trim() ||
    branding.legalCompanyName.trim() ||
    envFrom ||
    "Platform";
  return {
    logoUrl: brandingFileUrlFromPath(
      PLATFORM_BRANDING_ORG_KEY,
      branding.logoPath
    ),
    senderPhotoUrl: brandingFileUrlFromPath(
      PLATFORM_BRANDING_ORG_KEY,
      branding.senderPhotoPath
    ),
    websiteUrl: branding.websiteUrl.trim(),
    websiteLabel:
      branding.websiteLabel.trim() ||
      branding.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""),
    companyLegalName: company,
    businessAddress: branding.businessAddress.trim(),
    senderName: sender,
    senderTitle: branding.senderTitle.trim(),
    footerServices: branding.footerServices.trim(),
    availabilityLine: branding.availabilityLine.trim(),
    bookingUrl: branding.bookingUrl.trim(),
    ctaLabel: branding.ctaLabel.trim() || "Open dashboard",
  };
}

export function renderPlatformTransactionalEmail(input: {
  branding: EmailBranding | unknown;
  subject: string;
  /** Plain or simple HTML paragraphs */
  body: string;
  preheader?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  orgName?: string | null;
}): { subject: string; html: string; text: string; fromName: string } {
  const bare = asEmailBranding({ emailBranding: input.branding ?? {} });
  const b = resolvePlatformBrandingUrls(bare);
  const ctaUrl = input.ctaUrl || `${appBaseUrl()}/dashboard`;
  const ctaLabel = input.ctaLabel || b.ctaLabel;
  const preheader = input.preheader || input.subject;

  const bodyHtml = input.body.includes("<")
    ? input.body
    : `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1d2033;">${escapeHtml(input.body).replace(/\n/g, "<br/>")}</p>`;

  const logoBlock = b.logoUrl
    ? `<img src="${escapeHtml(b.logoUrl)}" width="40" height="40" alt="${escapeHtml(b.companyLegalName)}" style="display:block;width:40px;height:40px;border:0;border-radius:8px;">`
    : `<div style="width:40px;height:40px;border-radius:8px;background:#5b63f5;color:#fff;font:bold 16px/40px system-ui;text-align:center;">${escapeHtml((b.companyLegalName || "D").slice(0, 1).toUpperCase())}</div>`;

  const photoBlock = b.senderPhotoUrl
    ? `<img src="${escapeHtml(b.senderPhotoUrl)}" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border:0;border-radius:50%;">`
    : "";

  const titleLine = [b.senderTitle, b.companyLegalName]
    .filter(Boolean)
    .join(" · ");

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f5f9;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f9;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;">
        <tr><td style="padding:22px 32px;border-bottom:1px solid #eceef5;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="padding-right:12px;" valign="middle">${logoBlock}</td>
            <td valign="middle" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
              <div style="font-size:16px;font-weight:bold;color:#1d2033;">${escapeHtml(b.companyLegalName)}</div>
              ${input.orgName ? `<div style="font-size:12px;color:#7a7f99;padding-top:2px;">For ${escapeHtml(input.orgName)}</div>` : ""}
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:28px 32px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#1d2033;">${escapeHtml(input.subject)}</h1>
          ${bodyHtml}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;"><tr>
            <td style="border-radius:8px;background:#5b63f5;">
              <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">${escapeHtml(ctaLabel)}</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:0 32px 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #eceef5;padding-top:20px;width:100%;"><tr>
            ${photoBlock ? `<td valign="middle" style="padding-right:14px;width:48px;">${photoBlock}</td>` : ""}
            <td valign="middle">
              <div style="font-size:15px;font-weight:bold;color:#1d2033;">${escapeHtml(b.senderName)}</div>
              ${titleLine ? `<div style="font-size:13px;color:#7a7f99;line-height:1.5;">${escapeHtml(titleLine)}</div>` : ""}
              ${b.websiteUrl ? `<div style="font-size:13px;padding-top:2px;"><a href="${escapeHtml(b.websiteUrl)}" style="color:#5b63f5;text-decoration:none;font-weight:bold;">${escapeHtml(b.websiteLabel || b.websiteUrl)}</a></div>` : ""}
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="background:#0b0d18;padding:22px 32px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;border-radius:0 0 14px 14px;">
          ${b.footerServices ? `<div style="font-size:12px;line-height:1.5;color:#c9cce0;padding-bottom:10px;">${escapeHtml(b.footerServices)}</div>` : ""}
          ${b.availabilityLine ? `<div style="font-family:monospace;font-size:10px;letter-spacing:1px;color:#7d82a3;padding-bottom:10px;">${escapeHtml(b.availabilityLine)}</div>` : ""}
          <div style="font-size:11px;line-height:1.5;color:#7d82a3;">
            ${escapeHtml(b.companyLegalName)}${b.businessAddress ? ` · ${escapeHtml(b.businessAddress)}` : ""}
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    input.subject,
    "",
    input.body.replace(/<[^>]+>/g, ""),
    "",
    `${ctaLabel}: ${ctaUrl}`,
    "",
    b.senderName,
    titleLine,
    b.websiteUrl,
    [b.companyLegalName, b.businessAddress].filter(Boolean).join(" · "),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: input.subject,
    html,
    text,
    fromName: b.senderName || b.companyLegalName,
  };
}
