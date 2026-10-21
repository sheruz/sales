/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B4a smoke verify — schema columns + payment settings readability.
 * Usage: node scripts/b4a-verify-smoke.js
 */
const {
  createPrisma,
  columnExists,
  tableExists,
  inspectB32Schema,
} = require("./b3-2-lib");

async function main() {
  const p = createPrisma();
  const out = { ok: true, checks: {} };

  try {
    const b32 = await inspectB32Schema(p);
    out.checks.b32 = b32;
    if (!b32.ready) out.ok = false;

    const totpNeed = [
      "totp_secret_enc",
      "totp_enabled_at",
      "totp_recovery_codes_enc",
      "totp_enrollment_required",
    ];
    const totp = {};
    for (const col of totpNeed) {
      totp[col] = await columnExists(p, "users", col);
      if (!totp[col]) out.ok = false;
    }
    out.checks.totp = totp;
    out.checks.billingEmail = await columnExists(
      p,
      "organizations",
      "billing_email"
    );
    if (!out.checks.billingEmail) out.ok = false;

    out.checks.paymentSettingsTable = await tableExists(
      p,
      "payment_settings"
    );
    out.checks.billingTransactionsTable = await tableExists(
      p,
      "billing_transactions"
    );

    if (out.checks.paymentSettingsTable && b32.columns["payment_settings.email_branding"]) {
      try {
        const row = await p.paymentSettings.findUnique({
          where: { id: "default" },
        });
        out.checks.paymentSettingsReadable = true;
        out.checks.paymentSettingsExists = !!row;
      } catch (e) {
        out.ok = false;
        out.checks.paymentSettingsReadable = false;
        out.checks.paymentSettingsError =
          e instanceof Error ? e.message : String(e);
      }
    }

    if (out.checks.billingTransactionsTable) {
      const zero = await p.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS n FROM billing_transactions WHERE amount = 0`
      );
      const total = await p.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS n FROM billing_transactions`
      );
      out.checks.transactions = {
        total: total[0]?.n ?? 0,
        zeroAmount: zero[0]?.n ?? 0,
      };
    }

    console.log(JSON.stringify(out, null, 2));
    if (!out.ok) process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
