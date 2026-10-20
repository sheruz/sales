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

/** Platform / catalog noise — never needs org routing */
const SKIP_EVENT_TYPES = new Set([
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
  "price.created",
  "price.updated",
  "price.imported",
  "product.created",
  "product.updated",
  "product.imported",
  "api_key.created",
  "api_key.updated",
  "api_key.revoked",
  "client_token.created",
  "client_token.updated",
  "client_token.revoked",
  "discount.created",
  "discount.updated",
  "discount.imported",
  "notification_setting.updated",
  "report.created",
  "report.updated",
]);

const SKIP_EVENT_PREFIXES = [
  "price.",
  "product.",
  "api_key.",
  "client_token.",
  "discount.",
  "notification_setting.",
  "report.",
];

function isNoiseEventType(pe) {
  if (!pe) return false;
  if (SKIP_EVENT_TYPES.has(pe)) return true;
  return SKIP_EVENT_PREFIXES.some((p) => pe.startsWith(p));
}

function classifyWebhookRow(row) {
  const err = (row.error || "").toLowerCase();
  const eventType = row.event_type || row.eventType || "";
  const payload = row.payload || {};
  const pe = payload.event_type || eventType;

  if (err.includes("ignored platform owner") || err.includes("ignored older")) {
    return { to: "skipped", reason: row.error || "ignored" };
  }
  if (err.startsWith("unhandled event") || /unhandled event/i.test(err)) {
    return { to: "skipped", reason: row.error || `unhandled ${pe}` };
  }
  // Catalog / auth noise — skip even when stored as "missing organizationId"
  if (
    (row.status === "unmatched" || row.status === "error") &&
    isNoiseEventType(pe)
  ) {
    return { to: "skipped", reason: `noise event ${pe}` };
  }
  // adjustment.* without org can stay unmatched (may need linking)
  if (row.status === "unmatched" && err.includes("missing organizationid")) {
    return { to: "unmatched", reason: row.error };
  }
  if (row.status === "error") {
    return { to: "error", reason: row.error };
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
  isNoiseEventType,
  SKIP_EVENT_TYPES,
};
