/* eslint-disable @typescript-eslint/no-require-imports */
require("./load-env");
const { ensureDatabaseUrl } = require("./database-url");
ensureDatabaseUrl();

const {
  createPrisma,
  readOnlyPrisma,
  tableExists,
  columnExists,
  isApply,
} = require("./s2-lib");

/** Paddle minor → major (mirror of src/lib/billing/paddle-amounts.ts) */
function minorToMajor(raw, currency = "USD") {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (!Number.isInteger(n) && Math.abs(n) < 1_000_000) {
    return Math.round(n * 100) / 100;
  }
  const zero = new Set(["JPY", "KRW", "VND"]);
  if (zero.has(String(currency).toUpperCase())) return Math.round(n);
  return Math.round(n) / 100;
}

function parsePaddleMoney(payload) {
  const root = payload || {};
  const data = root.data && typeof root.data === "object" ? root.data : root;
  const details = data.details || {};
  const totals = details.totals || data.totals || {};
  const payout = details.payout_totals || data.payout_totals || {};
  const currency = String(
    totals.currency_code || data.currency_code || payout.currency_code || "USD"
  ).toUpperCase();
  const amount =
    minorToMajor(totals.grand_total ?? totals.total ?? totals.subtotal, currency) ??
    0;
  const tax = minorToMajor(totals.tax ?? totals.total_tax, currency);
  const fee = minorToMajor(payout.fee ?? totals.fee, currency);
  let net = minorToMajor(payout.earnings ?? payout.total, currency);
  if (net == null && fee != null) net = Math.round((amount - fee) * 100) / 100;
  return { amount, tax, fee, net, currency };
}

function classifyWebhookRow(row) {
  const err = (row.error || "").toLowerCase();
  const eventType = row.event_type || "";
  const payload = row.payload || {};
  const pe = payload.event_type || eventType;

  if (err.includes("ignored platform owner") || err.includes("ignored older")) {
    return { to: "skipped", reason: row.error || "ignored" };
  }
  if (err.startsWith("unhandled event") || /unhandled event/i.test(err)) {
    return { to: "skipped", reason: row.error || `unhandled ${pe}` };
  }
  // Known noise event types often stored as unmatched
  const skipTypes = [
    "transaction.created",
    "transaction.updated",
    "transaction.ready",
    "transaction.paid",
    "customer.created",
    "customer.updated",
    "address.created",
    "address.updated",
    "business.created",
    "business.updated",
    "subscription.trialing",
    "subscription.activated",
  ];
  if (
    (row.status === "unmatched" || row.status === "error") &&
    skipTypes.some((t) => pe === t || err.includes(t))
  ) {
    return { to: "skipped", reason: `noise event ${pe}` };
  }
  if (row.status === "unmatched" && err.includes("missing organizationid")) {
    return { to: "unmatched", reason: row.error }; // keep — real
  }
  if (row.status === "error") {
    return { to: "error", reason: row.error }; // keep
  }
  if (row.status === "unmatched") {
    return { to: "unmatched", reason: row.error };
  }
  return { to: row.status, reason: row.error };
}

module.exports = {
  createPrisma,
  readOnlyPrisma,
  isApply,
  tableExists,
  columnExists,
  parsePaddleMoney,
  minorToMajor,
  classifyWebhookRow,
};
