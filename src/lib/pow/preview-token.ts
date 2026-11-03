/**
 * PoW — HMAC tokens for evidence screenshots + helpers for /for/{slug} page URLs.
 * Errors must stay generic (no org/company leak).
 */
import { createHmac, timingSafeEqual } from "crypto";

export type PowPreviewPayload = {
  v: 1;
  kind: "pow_preview";
  organizationId: string;
  evidenceId: string;
  pitchId: string;
  /** Bound when day-0 outbox is queued (visit attribution). */
  outboxId?: string;
  exp: number;
};

/** Spec default: 60 days (overridable via ttlMs / POW_PREVIEW_TTL_DAYS). */
export const DEFAULT_PREVIEW_TTL_MS = 60 * 24 * 60 * 60 * 1000;

function secret(): string {
  return (
    process.env.JWT_SECRET ||
    process.env.ENCRYPTION_KEY ||
    "pow-preview-dev-secret"
  );
}

function appBase(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function previewTtlMsFromEnv(): number {
  const days = Number(process.env.POW_PREVIEW_TTL_DAYS || "60");
  if (!Number.isFinite(days) || days < 1) return DEFAULT_PREVIEW_TTL_MS;
  return Math.floor(days * 24 * 60 * 60 * 1000);
}

function sign(payloadB64: string): string {
  return createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

export function createPowPreviewToken(payload: PowPreviewPayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifyPowPreviewToken(token: string): PowPreviewPayload | null {
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  const expected = sign(payloadB64);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const json = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as PowPreviewPayload;
    if (
      !json ||
      json.v !== 1 ||
      json.kind !== "pow_preview" ||
      !json.organizationId ||
      !json.evidenceId ||
      !json.pitchId
    ) {
      return null;
    }
    if (typeof json.exp !== "number" || json.exp < Date.now()) return null;
    return json;
  } catch {
    return null;
  }
}

/** Screenshot asset URL (embedded on the personal preview page). */
export function mintPowEvidenceUrl(input: {
  organizationId: string;
  evidenceId: string;
  pitchId: string;
  outboxId?: string;
  expiresAt?: Date | null;
  ttlMs?: number;
}): { token: string; url: string; exp: number } {
  const ttl = input.ttlMs ?? previewTtlMsFromEnv();
  let exp = Date.now() + ttl;
  if (input.expiresAt) {
    const cap = input.expiresAt.getTime();
    if (Number.isFinite(cap)) exp = Math.min(exp, cap);
  }
  const token = createPowPreviewToken({
    v: 1,
    kind: "pow_preview",
    organizationId: input.organizationId,
    evidenceId: input.evidenceId,
    pitchId: input.pitchId,
    outboxId: input.outboxId,
    exp,
  });
  return {
    token,
    url: `${appBase()}/api/pow/preview/${encodeURIComponent(token)}`,
    exp,
  };
}

/** @deprecated use mintPowEvidenceUrl + powPreviewPageService for /for/ page */
export function mintPowPreview(input: {
  organizationId: string;
  evidenceId: string;
  pitchId: string;
  outboxId?: string;
  expiresAt?: Date | null;
  ttlMs?: number;
  /** When set, email link points at the personal page instead of raw image */
  publicSlug?: string;
}): { token: string; url: string; exp: number } {
  const evidence = mintPowEvidenceUrl(input);
  if (input.publicSlug) {
    return {
      ...evidence,
      url: `${appBase()}/for/${encodeURIComponent(input.publicSlug)}`,
    };
  }
  return evidence;
}

export function powPreviewPageUrl(publicSlug: string): string {
  return `${appBase()}/for/${encodeURIComponent(publicSlug)}`;
}
