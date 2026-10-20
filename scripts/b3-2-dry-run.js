/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B3.2 dry-run — billing contact fields, BillingTransaction, seller emails, isolation checks.
 */
const { createPrisma, inspectB32Schema, verifyB32 } = require("./b3-2-lib");

async function main() {
  const prisma = createPrisma();
  try {
    const schema = await inspectB32Schema(prisma);
    const verify = await verifyB32(prisma);
    console.log(
      JSON.stringify(
        {
          phase: "B3.2",
          mode: "dry-run",
          schema,
          verify: {
            sharedPaddleCustomers: verify.sharedPaddleCustomers,
            orgsMissingBillingEmail: verify.orgsMissingBillingEmail,
            ok: verify.ok,
          },
          planned: [
            "ADD organizations.billing_contact_name / billing_address / billing_country / billing_tax_id",
            "ADD payment_settings.seller_admin_emails",
            "CREATE billing_transactions",
            "ALTER NotificationType ADD BILLING_SELLER_ALERT (if missing)",
            "Backfill billing_email from primary admin where null",
            "Clear shared paddle_customer_id collisions (keep oldest org)",
          ],
          next: "Backup DB, then APPLY=1 node scripts/b3-2-apply.js after GO",
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
