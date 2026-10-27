/** PoW2 finding-type tags for starter-offer matching */
export const STARTER_FINDING_TYPES = [
  "slow_site",
  "broken_form",
  "broken_images",
  "ssl_https",
  "mobile_layout",
  "no_booking",
  "outdated_design",
  "other",
] as const;

export type StarterFindingType = (typeof STARTER_FINDING_TYPES)[number];

export const POW_SEQUENCE_NAME = "Proof of Work";

/** Env / runtime flag — PoW sequences cannot send until PoW3 flips this on */
export const POW_SEND_ENV_KEY = "POW_SEND_ENABLED";

export const POW_WORD_MIN = 60;
export const POW_WORD_MAX = 100;
export const POW_SUBJECT_MAX = 50;

/** Map deep-finding ids → starter-offer finding types */
export function findingIdToType(findingId: string): StarterFindingType {
  const id = findingId.toLowerCase();
  if (id.includes("slow") || id.includes("psi") || id.includes("lcp")) {
    return "slow_site";
  }
  if (id.includes("form")) return "broken_form";
  if (id.includes("image")) return "broken_images";
  if (id.includes("ssl") || id.includes("https")) return "ssl_https";
  if (id.includes("mobile") || id.includes("overflow") || id.includes("viewport")) {
    return "mobile_layout";
  }
  if (id.includes("booking") || id.includes("calendar")) return "no_booking";
  if (id.includes("design") || id.includes("outdated")) return "outdated_design";
  return "other";
}
