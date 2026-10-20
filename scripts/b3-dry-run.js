/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B3 dry-run (READ-ONLY). Schema plan + Delvix exclusion check.
 */
const { readOnlyPrisma, inspectB3Schema } = require("./b3-lib");

async function main() {
  const prisma = readOnlyPrisma();
  const ownerId = process.env.PLATFORM_OWNER_ORG_ID || null;
  const out = {
    phase: "B3",
    mode: "DRY_RUN",
    at: new Date().toISOString(),
    platformOwnerOrgId: ownerId,
    schema: null,
    delvix: null,
    notes: [],
    fatal: [],
  };

  try {
    out.schema = await inspectB3Schema(prisma);
    if (!out.schema.ready) {
      out.notes.push(
        "Schema not ready — APPLY=1 node scripts/b3-apply.js after backup + GO"
      );
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
      `Webhook URL: ${(process.env.APP_URL || "").replace(/\/$/, "")}/api/billing/webhooks/paddle`
    );
    out.notes.push(
      `PAYMENTS_ENABLED=${process.env.PAYMENTS_ENABLED || "false"} (keep false until sandbox pass)`
    );
    out.notes.push("Stripe routes return 410; Paddle is default provider");
  } catch (err) {
    out.fatal.push(err instanceof Error ? err.message : String(err));
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  console.log(JSON.stringify(out, null, 2));
  if (out.fatal.length) process.exit(1);
}

main();
