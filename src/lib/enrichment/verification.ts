import type { EmailVerificationStatus } from "@/lib/enrichment/types";

/** Map Hunter verifier result → our status. */
export function mapHunterVerificationStatus(
  result: string | null | undefined
): EmailVerificationStatus {
  const r = (result || "").toLowerCase().trim();
  if (r === "valid" || r === "deliverable") return "valid";
  if (r === "accept_all" || r === "accept-all" || r === "webmail") {
    return "accept_all";
  }
  if (r === "invalid" || r === "undeliverable" || r === "disposable") {
    return "invalid";
  }
  return "unknown";
}

export function isEnrollableVerification(
  status: EmailVerificationStatus,
  allowAcceptAll = false
): boolean {
  if (status === "valid" || status === "valid_manual") return true;
  if (status === "accept_all" && allowAcceptAll) return true;
  return false;
}
