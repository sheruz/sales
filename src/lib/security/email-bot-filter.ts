/**
 * Shared email security / prefetch bot detection for Phase 4 open/click
 * and PoW3 preview human-visit tracking.
 */

export type BotFilterInput = {
  userAgent?: string | null;
  /** Client IP (optional; used for datacenter heuristics). */
  ip?: string | null;
  /**
   * When set with ip, visits within this window from datacenter IPs
   * are treated as bots (link scanners right after send).
   */
  sentAt?: Date | null;
  /** Seconds after send to treat datacenter hits as bots (default 60). */
  postSendBotWindowSec?: number;
};

export type BotFilterResult = {
  isBot: boolean;
  reason: string | null;
  /** Stable label for metadata */
  category:
    | "human"
    | "security_scanner"
    | "prefetch"
    | "datacenter_post_send"
    | "known_bot";
};

/** Known email security / image-proxy / link-wrapper user-agent substrings (case-insensitive). */
export const EMAIL_SECURITY_UA_PATTERNS: readonly string[] = [
  "microsoft office",
  "ms-office",
  "safelinks",
  "protection.outlook",
  "microsoft defender",
  "defender athena",
  "mimecast",
  "proofpoint",
  "urldefense",
  "barracuda",
  "barracudanetworks",
  "fireeye",
  "symantec",
  "messagelabs",
  "forcepoint",
  "cisco ironport",
  "ironport",
  "spamassassin",
  "googleimageproxy",
  "google-proxy",
  "ggpht.com",
  "yahoo mail proxy",
  "yahoomailproxy",
  "facebookexternalhit",
  "slackbot-linkexpanding",
  "twitterbot",
  "linkedinbot",
  "petalbot",
  "bytespider",
  "headlesschrome",
  "phantomjs",
  "curl/",
  "wget/",
  "python-requests",
  "go-http-client",
  "java/",
  "libwww-perl",
  "okhttp",
];

/** Crude datacenter / cloud IP prefixes (not exhaustive — defense in depth with UA). */
const DATACENTER_V4_PREFIXES = [
  "3.", // AWS legacy
  "13.",
  "18.",
  "34.",
  "35.",
  "52.",
  "54.",
  "99.",
  "100.20.",
  "100.24.",
  "104.40.", // Azure
  "104.41.",
  "104.42.",
  "104.43.",
  "104.44.",
  "104.45.",
  "104.46.",
  "13.107.", // Microsoft
  "40.8",
  "40.9",
  "40.7",
  "20.19",
  "20.36",
  "20.37",
  "20.38",
  "66.102.", // Google
  "66.249.",
  "64.233.",
  "72.14.",
  "74.125.",
  "108.177.",
  "142.250.",
  "172.217.",
  "216.58.",
];

export function looksLikeDatacenterIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const v = ip.trim().toLowerCase();
  if (v === "::1" || v.startsWith("127.")) return true;
  return DATACENTER_V4_PREFIXES.some((p) => v.startsWith(p));
}

export function matchEmailSecurityUa(
  userAgent: string | null | undefined
): string | null {
  if (!userAgent || !userAgent.trim()) return "empty_ua";
  const ua = userAgent.toLowerCase();
  for (const pattern of EMAIL_SECURITY_UA_PATTERNS) {
    if (ua.includes(pattern)) return pattern;
  }
  return null;
}

/**
 * Classify a tracking hit. Bots must never count toward open/click rates or HOT.
 */
export function classifyEmailTraffic(
  input: BotFilterInput
): BotFilterResult {
  const uaHit = matchEmailSecurityUa(input.userAgent);
  if (uaHit === "empty_ua") {
    return {
      isBot: true,
      reason: "empty_user_agent",
      category: "known_bot",
    };
  }
  if (uaHit) {
    return {
      isBot: true,
      reason: `ua:${uaHit}`,
      category: "security_scanner",
    };
  }

  const windowSec = input.postSendBotWindowSec ?? 60;
  if (
    input.sentAt &&
    input.ip &&
    looksLikeDatacenterIp(input.ip)
  ) {
    const ageMs = Date.now() - input.sentAt.getTime();
    if (ageMs >= 0 && ageMs <= windowSec * 1000) {
      return {
        isBot: true,
        reason: "datacenter_within_post_send_window",
        category: "datacenter_post_send",
      };
    }
  }

  return { isBot: false, reason: null, category: "human" };
}

/** Convenience for callers that only need a boolean. */
export function isEmailSecurityBot(input: BotFilterInput): boolean {
  return classifyEmailTraffic(input).isBot;
}
