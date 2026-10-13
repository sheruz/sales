/**
 * Website inbound — additive enum value INBOUND_FORM.
 *
 * Usage:
 *   DRY_RUN=1 node scripts/website-inbound-migrate.js
 *   node scripts/website-inbound-migrate.js
 */
const { PrismaClient } = require("@prisma/client");
require("./load-env");

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

async function enumHasValue(client, enumName, value) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1 FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = $1 AND e.enumlabel = $2 LIMIT 1`,
    enumName,
    value
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN" : "APPLY");
  if (await enumHasValue(prisma, "CompanyTimelineEventType", "INBOUND_FORM")) {
    console.log("  skip CompanyTimelineEventType.INBOUND_FORM");
  } else {
    console.log("  add CompanyTimelineEventType.INBOUND_FORM");
    if (!DRY_RUN) {
      await prisma.$executeRawUnsafe(
        `ALTER TYPE "CompanyTimelineEventType" ADD VALUE IF NOT EXISTS 'INBOUND_FORM'`
      );
    }
  }
  console.log("done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
