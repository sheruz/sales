/** Approximate Hunter credit costs for spend visibility (1 credit ≈ $0.01 rough). */
export const HUNTER_COST_USD = {
  domainSearch: 0.01,
  emailVerifier: 0.01,
  account: 0,
};

export function estimateHunterCostUsd(
  operation: "domain_search" | "email_verifier" | "account"
): number {
  if (operation === "domain_search") return HUNTER_COST_USD.domainSearch;
  if (operation === "email_verifier") return HUNTER_COST_USD.emailVerifier;
  return HUNTER_COST_USD.account;
}
