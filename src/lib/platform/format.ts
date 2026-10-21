/** Platform console money / date helpers */

export function formatMoney(
  amount: number | string | null | undefined,
  opts?: { currency?: string; compact?: boolean }
): string {
  const n = typeof amount === "string" ? Number(amount) : Number(amount ?? 0);
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

export function formatMoneyShort(
  amount: number | string | null | undefined
): string {
  const n = typeof amount === "string" ? Number(amount) : Number(amount ?? 0);
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
