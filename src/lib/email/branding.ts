import { env } from "@/lib/config/env";
import {
  formatWhatsappDisplay,
  normalizeWhatsappE164,
  whatsappDigits,
} from "@/lib/email/whatsapp";

export type EmailBranding = {
  logoPath: string | null;
  senderPhotoPath: string | null;
  senderName: string;
  senderTitle: string;
  websiteUrl: string;
  websiteLabel: string;
  whatsappE164: string;
  bookingUrl: string;
  ctaLabel: string;
  footerServices: string;
  availabilityLine: string;
  legalCompanyName: string;
  businessAddress: string;
};

/** Neutral blanks — never Delvix/owner defaults. Tenants must fill setup. */
export const DEFAULT_EMAIL_BRANDING: EmailBranding = {
  logoPath: null,
  senderPhotoPath: null,
  senderName: "",
  senderTitle: "",
  websiteUrl: "",
  websiteLabel: "",
  whatsappE164: "",
  bookingUrl: "",
  ctaLabel: "Book a call",
  footerServices: "",
  availabilityLine: "",
  legalCompanyName: "",
  businessAddress: "",
};

export function asEmailBranding(raw: unknown): EmailBranding {
  const root =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const o =
    root.emailBranding &&
    typeof root.emailBranding === "object" &&
    !Array.isArray(root.emailBranding)
      ? (root.emailBranding as Record<string, unknown>)
      : {};

  const str = (k: keyof EmailBranding, fallback: string) =>
    typeof o[k] === "string" ? (o[k] as string) : fallback;

  const whatsapp =
    normalizeWhatsappE164(
      typeof o.whatsappE164 === "string" ? o.whatsappE164 : ""
    ) ?? "";

  return {
    logoPath:
      typeof o.logoPath === "string" && o.logoPath ? o.logoPath : null,
    senderPhotoPath:
      typeof o.senderPhotoPath === "string" && o.senderPhotoPath
        ? o.senderPhotoPath
        : null,
    senderName: str("senderName", DEFAULT_EMAIL_BRANDING.senderName),
    senderTitle: str("senderTitle", DEFAULT_EMAIL_BRANDING.senderTitle),
    websiteUrl: str("websiteUrl", DEFAULT_EMAIL_BRANDING.websiteUrl),
    websiteLabel: str("websiteLabel", DEFAULT_EMAIL_BRANDING.websiteLabel),
    whatsappE164: whatsapp,
    bookingUrl: str("bookingUrl", DEFAULT_EMAIL_BRANDING.bookingUrl),
    ctaLabel: str("ctaLabel", DEFAULT_EMAIL_BRANDING.ctaLabel),
    footerServices: str("footerServices", DEFAULT_EMAIL_BRANDING.footerServices),
    availabilityLine: str(
      "availabilityLine",
      DEFAULT_EMAIL_BRANDING.availabilityLine
    ),
    legalCompanyName: str(
      "legalCompanyName",
      DEFAULT_EMAIL_BRANDING.legalCompanyName
    ),
    businessAddress: str(
      "businessAddress",
      DEFAULT_EMAIL_BRANDING.businessAddress
    ),
  };
}

/** Public URL served by `app/branding/[orgId]/[filename]/route.ts`. */
export function brandingPublicUrl(
  organizationId: string,
  filename: string,
  cacheBust?: string | number
): string {
  const base = env.APP_URL.replace(/\/$/, "");
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "");
  const url = `${base}/branding/${organizationId}/${safe}`;
  if (cacheBust == null || cacheBust === "") return url;
  return `${url}?v=${encodeURIComponent(String(cacheBust))}`;
}

export function brandingFileUrlFromPath(
  organizationId: string,
  relativePath: string | null | undefined,
  cacheBust?: string | number
): string | null {
  if (!relativePath) return null;
  // relativePath like branding/{orgId}/logo.png or just logo.png
  const parts = relativePath.replace(/\\/g, "/").split("/");
  const filename = parts[parts.length - 1];
  if (!filename) return null;
  return brandingPublicUrl(organizationId, filename, cacheBust);
}

export type ResolvedSender = {
  senderName: string;
  senderTitle: string;
  senderPhotoUrl: string | null;
  logoUrl: string | null;
  websiteUrl: string;
  websiteLabel: string;
  whatsappDigits: string;
  whatsappDisplay: string;
  ctaUrl: string;
  ctaLabel: string;
  footerServices: string;
  availabilityLine: string;
  companyLegalName: string;
  businessAddress: string;
};

export function resolveSenderBranding(input: {
  organizationId: string;
  branding: EmailBranding;
  mailbox?: {
    senderName?: string | null;
    senderTitle?: string | null;
    senderPhotoPath?: string | null;
  } | null;
  orgFallbackName?: string;
}): ResolvedSender {
  const b = input.branding;
  const mb = input.mailbox;
  const digits = whatsappDigits(b.whatsappE164) ?? "";
  return {
    senderName:
      mb?.senderName?.trim() ||
      b.senderName.trim() ||
      input.orgFallbackName?.trim() ||
      "",
    senderTitle: mb?.senderTitle?.trim() || b.senderTitle.trim() || "",
    senderPhotoUrl:
      brandingFileUrlFromPath(
        input.organizationId,
        mb?.senderPhotoPath || b.senderPhotoPath
      ) ?? null,
    logoUrl:
      brandingFileUrlFromPath(input.organizationId, b.logoPath) ?? null,
    websiteUrl: b.websiteUrl.trim(),
    websiteLabel: b.websiteLabel.trim(),
    whatsappDigits: digits,
    whatsappDisplay: formatWhatsappDisplay(b.whatsappE164),
    ctaUrl: b.bookingUrl.trim() || b.websiteUrl.trim() || "#",
    ctaLabel: b.ctaLabel.trim() || DEFAULT_EMAIL_BRANDING.ctaLabel,
    footerServices: b.footerServices.trim(),
    availabilityLine: b.availabilityLine.trim(),
    companyLegalName:
      b.legalCompanyName.trim() || input.orgFallbackName?.trim() || "",
    businessAddress: b.businessAddress.trim(),
  };
}
