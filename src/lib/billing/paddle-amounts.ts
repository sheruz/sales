/**
 * B4a: Parse Paddle Billing money fields (string minor units → major currency).
 * Paddle totals are typically in the smallest currency unit (e.g. "4900" = $49.00).
 */

export type ParsedMoney = {
  amount: number;
  tax: number | null;
  fee: number | null;
  net: number | null;
  currency: string;
};

function toNumber(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Convert Paddle minor-unit integer/string to major units (2dp). */
export function minorToMajor(raw: unknown, currency = "USD"): number | null {
  const n = toNumber(raw);
  if (n == null) return null;
  // Already looks like major (has fraction or small typical USD price)
  if (!Number.isInteger(n) && Math.abs(n) < 1_000_000) {
    return Math.round(n * 100) / 100;
  }
  // Zero-decimal currencies (rare for us) — treat as major if JPY etc.
  const zeroDecimal = new Set(["JPY", "KRW", "VND"]);
  if (zeroDecimal.has(currency.toUpperCase())) {
    return Math.round(n);
  }
  return Math.round(n) / 100;
}

/**
 * Extract totals from a Paddle transaction/adjustment payload (`data` object or full event).
 */
export function parsePaddleMoney(payload: unknown): ParsedMoney {
  const root = (payload || {}) as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object"
    ? root.data
    : root) as Record<string, unknown>;

  const details = (data.details || {}) as Record<string, unknown>;
  const totals = (details.totals || data.totals || {}) as Record<string, unknown>;
  const payoutTotals = (details.payout_totals ||
    data.payout_totals ||
    {}) as Record<string, unknown>;

  const currency = String(
    totals.currency_code ||
      data.currency_code ||
      payoutTotals.currency_code ||
      "USD"
  ).toUpperCase();

  const totalMinor =
    totals.grand_total ?? totals.total ?? totals.subtotal ?? null;
  const taxMinor = totals.tax ?? totals.total_tax ?? null;
  const feeMinor =
    payoutTotals.fee ??
    totals.fee ??
    (details.adjusted_totals as Record<string, unknown> | undefined)?.fee ??
    null;
  const earningsMinor =
    payoutTotals.earnings ?? payoutTotals.total ?? totals.earnings ?? null;

  const amount = minorToMajor(totalMinor, currency) ?? 0;
  const tax = minorToMajor(taxMinor, currency);
  const fee = minorToMajor(feeMinor, currency);
  let net = minorToMajor(earningsMinor, currency);
  if (net == null && fee != null) {
    net = Math.round((amount - fee) * 100) / 100;
  }

  return { amount, tax, fee, net, currency };
}

/** True if a BillingTransaction row looks like a broken $0 placeholder. */
export function isZeroAmountPlaceholder(amount: unknown): boolean {
  const n = Number(amount);
  return !Number.isFinite(n) || n === 0;
}
