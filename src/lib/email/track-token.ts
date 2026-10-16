import { createHmac, createHash, timingSafeEqual } from "crypto";

export type TrackLinkType = "cta" | "whatsapp" | "website";

export type OpenTrackPayload = {
  v: 1;
  kind: "o";
  organizationId: string;
  outboxId: string;
  exp: number;
};

export type ClickTrackPayload = {
  v: 1;
  kind: "c";
  organizationId: string;
  outboxId: string;
  linkType: TrackLinkType;
  dest: string;
  exp: number;
};

export type TrackPayload = OpenTrackPayload | ClickTrackPayload;

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function secret(): string {
  // Read process.env directly so unit tests don't require full env parse.
  return (
    process.env.JWT_SECRET ||
    process.env.ENCRYPTION_KEY ||
    "email-track-dev-secret"
  );
}

function appBase(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function sign(payloadB64: string): string {
  return createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

export function createTrackToken(payload: TrackPayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifyTrackToken(token: string): TrackPayload | null {
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
    ) as TrackPayload;
    if (!json || json.v !== 1 || !json.organizationId || !json.outboxId) {
      return null;
    }
    if (typeof json.exp === "number" && json.exp < Date.now()) return null;
    if (json.kind === "o") return json;
    if (json.kind === "c" && json.dest && json.linkType) return json;
    return null;
  } catch {
    return null;
  }
}

export function openPixelUrl(input: {
  organizationId: string;
  outboxId: string;
}): string {
  const token = createTrackToken({
    v: 1,
    kind: "o",
    organizationId: input.organizationId,
    outboxId: input.outboxId,
    exp: Date.now() + NINETY_DAYS_MS,
  });
  return `${appBase()}/t/o/${encodeURIComponent(token)}`;
}

export function clickTrackUrl(input: {
  organizationId: string;
  outboxId: string;
  linkType: TrackLinkType;
  destUrl: string;
}): string {
  const token = createTrackToken({
    v: 1,
    kind: "c",
    organizationId: input.organizationId,
    outboxId: input.outboxId,
    linkType: input.linkType,
    dest: input.destUrl,
    exp: Date.now() + NINETY_DAYS_MS,
  });
  return `${appBase()}/t/c/${encodeURIComponent(token)}`;
}

/** Append UTM params for GA website attribution (final destination). */
export function withEmailUtm(
  url: string,
  opts: {
    campaign?: string;
    content: string;
    outboxId: string;
  }
): string {
  try {
    const u = new URL(url);
    if (!u.protocol.startsWith("http")) return url;
    u.searchParams.set("utm_source", "delvix_email");
    u.searchParams.set("utm_medium", "email");
    u.searchParams.set("utm_campaign", opts.campaign || "cold_outreach");
    u.searchParams.set("utm_content", opts.content);
    u.searchParams.set("utm_term", opts.outboxId.slice(0, 8));
    return u.toString();
  } catch {
    return url;
  }
}

/** Stable GA4 client_id derived from org + recipient (no raw email sent to GA). */
export function gaClientId(organizationId: string, email?: string | null): string {
  const seed = `${organizationId}:${(email || "anon").toLowerCase()}`;
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 16);
  const n = BigInt(`0x${hex}`);
  return `${n % 2147483647n}.${Math.floor(Date.now() / 1000)}`;
}
