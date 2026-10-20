import type { EmailStyle } from "@prisma/client";
import { env } from "@/lib/config/env";
import { buildGreeting } from "@/lib/email/greeting";
import type { ResolvedSender } from "@/lib/email/branding";
import { whatsappMeUrl } from "@/lib/email/whatsapp";
import {
  clickTrackUrl,
  openPixelUrl,
  withEmailUtm,
} from "@/lib/email/track-token";
import { BRANDED_OUTBOUND_HTML } from "@/lib/email/templates/branded-outbound.template";

const MAX_HTML_BYTES = 100 * 1024;

function loadBrandedTemplate(): string {
  // Bundled constant — never depends on fs / cwd in production.
  return BRANDED_OUTBOUND_HTML;
}

function appBase(): string {
  return env.APP_URL.replace(/\/$/, "");
}

export type PitchEmailFields = {
  greeting?: string | null;
  introHtml?: string | null;
  findingTitle?: string | null;
  findingText?: string | null;
  bodyHtml?: string | null;
  preheader?: string | null;
  personalizedFirstLine?: string | null;
  shortPitch?: string | null;
  topIssue?: string | null;
};

/** When set, CTA / WhatsApp / website links + open pixel are tracked. */
export type EmailTrackContext = {
  organizationId: string;
  outboxId: string;
  campaign?: string;
};

export type RenderOutboundInput = {
  style: EmailStyle | "BRANDED" | "PLAIN";
  subject: string;
  pitch: PitchEmailFields;
  contact: {
    firstName?: string | null;
    email?: string | null;
  };
  company: {
    name?: string | null;
    domain?: string | null;
  };
  sender: ResolvedSender;
  unsubscribeUrl: string;
  track?: EmailTrackContext | null;
};

export type RenderOutboundResult = {
  subject: string;
  html: string;
  text: string;
  style: "BRANDED" | "PLAIN";
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Allow a small set of safe tags from AI intro/body; strip scripts/styles. */
export function sanitizeEmailHtmlFragment(html: string): string {
  let out = html.trim();
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/javascript:/gi, "");
  if (!/<[a-z][\s\S]*>/i.test(out)) {
    out = out
      .split(/\n{2,}/)
      .map(
        (p) =>
          `<p style="margin:0 0 12px 0;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`
      )
      .join("");
  }
  return out;
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return vars[key] ?? "";
  });
}

/** Convert simple HTML fragments to plain text. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&rarr;/g, "→")
    .replace(/&#9679;/g, "•")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function validateOutboundHtml(html: string): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > MAX_HTML_BYTES) {
    errors.push(`HTML exceeds 100KB (${bytes} bytes)`);
  }
  if (/<script[\s>]/i.test(html) || /<\/script>/i.test(html)) {
    errors.push("HTML must not contain script tags");
  }
  if (/<style[\s>]/i.test(html)) {
    errors.push("HTML must not contain style blocks");
  }
  const imgRe = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html))) {
    const tag = m[0];
    if (!/\balt\s*=\s*("[^"]*"|'[^']*')/i.test(tag)) {
      errors.push("Image missing alt text");
    }
  }
  return { ok: errors.length === 0, errors };
}

function resolvePitchCopy(pitch: PitchEmailFields, domain: string) {
  const intro =
    pitch.introHtml?.trim() ||
    (pitch.personalizedFirstLine
      ? `<p style="margin:0 0 12px 0;">${escapeHtml(pitch.personalizedFirstLine)}</p>`
      : domain
        ? `<p style="margin:0 0 12px 0;">I was reviewing ${escapeHtml(domain)} and noticed a few things worth a quick look.</p>`
        : `<p style="margin:0 0 12px 0;">I was reviewing your site and noticed a few things worth a quick look.</p>`);

  const findingTitle =
    pitch.findingTitle?.trim() ||
    pitch.topIssue?.trim() ||
    "A few opportunities on your site";

  const findingText =
    pitch.findingText?.trim() ||
    "Fixing this usually improves how visitors experience your business online.";

  const body =
    pitch.bodyHtml?.trim() ||
    (pitch.shortPitch
      ? `<p style="margin:0 0 12px 0;">${escapeHtml(pitch.shortPitch)}</p>`
      : `<p style="margin:0 0 12px 0;">We build practical software for teams like yours — happy to share a short example if useful.</p>`);

  const preheader = (pitch.preheader?.trim() || findingTitle).slice(0, 90);

  return {
    introHtml: sanitizeEmailHtmlFragment(intro),
    findingTitle,
    findingText,
    bodyHtml: sanitizeEmailHtmlFragment(body),
    preheader,
  };
}

function resolveTrackedLinks(
  sender: ResolvedSender,
  track: EmailTrackContext | null | undefined
) {
  const campaign = track?.campaign || "cold_outreach";
  const rawWa = sender.whatsappDigits
    ? whatsappMeUrl(sender.whatsappDigits) ||
      `https://wa.me/${sender.whatsappDigits}`
    : "";

  if (!track) {
    return {
      ctaUrl: sender.ctaUrl,
      websiteUrl: sender.websiteUrl,
      whatsappUrl: rawWa,
      openPixelUrl: "",
    };
  }

  const ctaDest = withEmailUtm(sender.ctaUrl, {
    campaign,
    content: "cta",
    outboxId: track.outboxId,
  });
  const websiteDest = withEmailUtm(sender.websiteUrl, {
    campaign,
    content: "website",
    outboxId: track.outboxId,
  });
  // WhatsApp: no UTM on wa.me (ignored); click still tracked via redirect.
  const whatsappDest = rawWa;

  return {
    ctaUrl: clickTrackUrl({
      organizationId: track.organizationId,
      outboxId: track.outboxId,
      linkType: "cta",
      destUrl: ctaDest,
    }),
    websiteUrl: clickTrackUrl({
      organizationId: track.organizationId,
      outboxId: track.outboxId,
      linkType: "website",
      destUrl: websiteDest,
    }),
    whatsappUrl: whatsappDest
      ? clickTrackUrl({
          organizationId: track.organizationId,
          outboxId: track.outboxId,
          linkType: "whatsapp",
          destUrl: whatsappDest,
        })
      : "",
    openPixelUrl: openPixelUrl({
      organizationId: track.organizationId,
      outboxId: track.outboxId,
    }),
  };
}

function renderBranded(input: RenderOutboundInput): RenderOutboundResult {
  const domain =
    input.company.domain?.replace(/^www\./, "") ||
    input.company.name ||
    "";
  const copy = resolvePitchCopy(input.pitch, domain);
  const greeting = buildGreeting({
    greeting: input.pitch.greeting,
    firstName: input.contact.firstName,
    email: input.contact.email,
  });
  const s = input.sender;
  const base = appBase();
  const logoUrl = s.logoUrl || `${base}/branding/placeholder-logo.png`;
  const photoUrl =
    s.senderPhotoUrl || `${base}/branding/placeholder-photo.png`;
  const links = resolveTrackedLinks(s, input.track);

  const vars: Record<string, string> = {
    subject: escapeHtml(input.subject),
    preheader: escapeHtml(copy.preheader),
    logo_url: logoUrl,
    greeting: escapeHtml(greeting),
    intro_html: copy.introHtml,
    finding_title: escapeHtml(copy.findingTitle),
    finding_text: escapeHtml(copy.findingText),
    body_html: copy.bodyHtml,
    cta_url: escapeHtml(links.ctaUrl),
    cta_label: escapeHtml(s.ctaLabel),
    whatsapp_url: escapeHtml(links.whatsappUrl),
    whatsapp_digits: s.whatsappDigits,
    whatsapp_display: escapeHtml(s.whatsappDisplay || s.whatsappDigits),
    sender_name: escapeHtml(s.senderName),
    sender_title: escapeHtml(s.senderTitle),
    sender_photo_url: photoUrl,
    website_url: escapeHtml(links.websiteUrl),
    website_label: escapeHtml(s.websiteLabel),
    company_legal_name: escapeHtml(s.companyLegalName),
    business_address: escapeHtml(s.businessAddress),
    unsubscribe_url: escapeHtml(input.unsubscribeUrl),
    footer_services: escapeHtml(s.footerServices).replace(/·/g, "&middot;"),
    availability_line: escapeHtml(s.availabilityLine)
      .replace(/·/g, "&middot;")
      .replace(/  /g, " &nbsp;"),
    open_pixel_url: escapeHtml(links.openPixelUrl),
  };

  let html = fillTemplate(loadBrandedTemplate(), vars);
  if (!s.whatsappDigits) {
    // Remove secondary WhatsApp CTA cell (second td in CTA row)
    html = html.replace(
      /(<td style="padding:0 10px 10px 0;">[\s\S]*?<\/td>)\s*<td style="padding:0 0 10px 0;">[\s\S]*?WhatsApp[\s\S]*?<\/td>/,
      "$1"
    );
    // Signature WhatsApp link → drop
    html = html.replace(
      /<span style="color:#c5c8d8;">&nbsp;\|&nbsp;<\/span>\s*<a href="[^"]*"[\s\S]*?<\/a>/,
      ""
    );
  }
  if (!links.openPixelUrl) {
    html = html.replace(
      /<img[^>]*src="\{\{open_pixel_url\}\}"[^>]*>/gi,
      ""
    );
    html = html.replace(/<img[^>]*width="1"[^>]*height="1"[^>]*>/gi, "");
  }

  const textParts = [
    greeting,
    htmlToPlainText(copy.introHtml),
    "",
    `WHAT WE NOTICED: ${copy.findingTitle}`,
    copy.findingText,
    "",
    htmlToPlainText(copy.bodyHtml),
    "",
    `${s.ctaLabel}: ${links.ctaUrl}`,
    links.whatsappUrl ? `WhatsApp: ${links.whatsappUrl}` : "",
    "",
    s.senderName,
    [s.senderTitle, s.companyLegalName].filter(Boolean).join(" · "),
    links.websiteUrl,
    "",
    [s.companyLegalName, s.businessAddress].filter(Boolean).join(" · "),
    `Unsubscribe: ${input.unsubscribeUrl}`,
  ].filter((x) => x !== "");

  return {
    subject: input.subject,
    html,
    text: textParts.join("\n"),
    style: "BRANDED",
  };
}

function renderPlain(input: RenderOutboundInput): RenderOutboundResult {
  const domain = input.company.domain?.replace(/^www\./, "") || "";
  const copy = resolvePitchCopy(input.pitch, domain);
  const greeting = buildGreeting({
    greeting: input.pitch.greeting,
    firstName: input.contact.firstName,
    email: input.contact.email,
  });
  const s = input.sender;
  const links = resolveTrackedLinks(s, input.track);

  const text = [
    greeting,
    "",
    htmlToPlainText(copy.introHtml),
    "",
    copy.findingTitle,
    copy.findingText,
    "",
    htmlToPlainText(copy.bodyHtml),
    "",
    links.ctaUrl ? `${s.ctaLabel}: ${links.ctaUrl}` : null,
    links.whatsappUrl ? `WhatsApp: ${links.whatsappUrl}` : null,
    "",
    s.senderName,
    s.senderTitle,
    "",
    "Unsubscribe: " + input.unsubscribeUrl,
  ]
    .filter((x) => x != null && x !== "")
    .join("\n");

  const pixel = links.openPixelUrl
    ? `<img src="${escapeHtml(links.openPixelUrl)}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`
    : "";

  const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1d2033;">${text
    .split("\n")
    .map((line) =>
      line === ""
        ? "<br>"
        : `<div>${escapeHtml(line).replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" style="color:#5b63f5;">$1</a>'
          )}</div>`
    )
    .join("")}${pixel}</div>`;

  return {
    subject: input.subject,
    html,
    text,
    style: "PLAIN",
  };
}

export function renderOutboundEmail(
  input: RenderOutboundInput
): RenderOutboundResult {
  const style = input.style === "BRANDED" ? "BRANDED" : "PLAIN";
  const result =
    style === "BRANDED" ? renderBranded(input) : renderPlain(input);
  const check = validateOutboundHtml(result.html);
  if (!check.ok) {
    throw new Error(`Email HTML validation failed: ${check.errors.join("; ")}`);
  }
  return result;
}

/** True if finding_title looks like a raw audit check label. */
export function looksLikeRawAuditLabel(
  title: string,
  checkLabels: string[]
): boolean {
  const t = title.trim().toLowerCase();
  if (!t) return false;
  for (const label of checkLabels) {
    const l = label.trim().toLowerCase();
    if (!l) continue;
    if (t === l) return true;
  }
  if (/^no\s+.+\s+detected$/i.test(title)) return true;
  if (/\bnot detected\b/i.test(title)) return true;
  if (/\bfailing\b/i.test(title) && /\bcheck\b/i.test(title)) return true;
  return false;
}
