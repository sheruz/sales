/** Platform console money / date helpers */

/** Prisma Decimal | number | string → finite number */
function toMoneyNumber(amount: unknown): number {
  if (amount == null) return 0;
  if (typeof amount === "number") return amount;
  if (typeof amount === "string") return Number(amount);
  if (
    typeof amount === "object" &&
    amount !== null &&
    "toNumber" in amount &&
    typeof (amount as { toNumber: () => number }).toNumber === "function"
  ) {
    return (amount as { toNumber: () => number }).toNumber();
  }
  return Number(amount);
}

export function formatMoney(
  amount: unknown,
  opts?: { currency?: string; compact?: boolean }
): string {
  const n = toMoneyNumber(amount);
  if (!Number.isFinite(n)) return "$0.00";
  const currency = opts?.currency || "USD";
  if (opts?.compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatMoneyShort(amount: unknown): string {
  const n = toMoneyNumber(amount);
  if (!Number.isFinite(n)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPlatformDate(
  value: Date | string | null | undefined
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatPlatformDateTime(
  value: Date | string | null | undefined
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatSignedMoney(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatMoney(delta)}`;
}
