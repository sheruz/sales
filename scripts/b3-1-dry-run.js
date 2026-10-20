/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B3.1 dry-run (READ-ONLY). Schema plan + Delvix exclusion.
 */
const { readOnlyPrisma, inspectB31Schema } = require("./b3-1-lib");

async function main() {
  const prisma = readOnlyPrisma();
  const ownerId = process.env.PLATFORM_OWNER_ORG_ID || null;
  const out = {
    phase: "B3.1",
    mode: "DRY_RUN",
    at: new Date().toISOString(),
    platformOwnerOrgId: ownerId,
    schema: null,
    delvix: null,
    planned: [
      "ADD organizations.allowed_checkout_methods",
      "ADD organizations.stripe_customer_id / stripe_customer_env",
      "ALTER organizations.billing_provider DROP NOT NULL (null = use default)",
      "CREATE payment_provider_configs (+ seed PADDLE/STRIPE/MANUAL_*)",
      "CREATE payment_settings (migrate platform_billing JSON if present)",
      "Runtime: PAYMENTS_EMERGENCY_DISABLE only; ignore PADDLE_*/PAYMENTS_ENABLED after import",
    ],
    notes: [],
    fatal: [],
  };

  try {
    out.schema = await inspectB31Schema(prisma);
    if (!out.schema.ready) {
      out.notes.push(
        "Schema not ready — APPLY=1 node scripts/b3-1-apply.js after backup + GO"
      );
    } else {
      out.notes.push("Schema already applied");
    }

    if (ownerId) {
      const org = await prisma.organization.findUnique({
        where: { id: ownerId },
        select: { id: true, name: true, billingProvider: true },
      });
      out.delvix = {
        found: !!org,
        name: org?.name ?? null,
        billingProvider: org?.billingProvider ?? null,
        excludedFromBilling: true,
        note: "PLATFORM_OWNER_ORG_ID is never invoiced, synced, or checked out",
      };
    } else {
      out.notes.push("PLATFORM_OWNER_ORG_ID unset — set before enabling payments");
    }

    out.notes.push(
      `PAYMENTS_EMERGENCY_DISABLE=${process.env.PAYMENTS_EMERGENCY_DISABLE || "false"}`
    );
    out.notes.push(
      "Webhook URLs: {APP_URL}/api/billing/webhooks/paddle and .../stripe"
    );
  } catch (err) {
    out.fatal.push(err instanceof Error ? err.message : String(err));
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  console.log(JSON.stringify(out, null, 2));
  if (out.fatal.length) process.exit(1);
}

main();
