/**
 * Email redesign — additive schema:
 * - EmailStyle enum + outreach_sequence_steps.email_style
 * - Pitch email fields (greeting, intro_html, finding_*, body_html, preheader)
 * - EmailOutbox.body_html
 * - OutboundMailbox sender overrides + allow_free_mail_provider
 *
 * Usage:
 *   DRY_RUN=1 npm run db:migrate:email-redesign
 *   npm run db:migrate:email-redesign
 */
const { PrismaClient } = require("@prisma/client");
require("./load-env");

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

async function columnExists(client, table, column) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     LIMIT 1`,
    table,
    column
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function enumExists(client, name) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1 FROM pg_type WHERE typname = $1 LIMIT 1`,
    name
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function ensureColumn(client, table, column, ddl) {
  if (await columnExists(client, table, column)) {
    console.log(`  skip ${table}.${column}`);
    return;
  }
  console.log(`  add ${table}.${column}`);
  if (!DRY_RUN) await client.$executeRawUnsafe(ddl);
}

async function main() {
  console.log(DRY_RUN ? "DRY_RUN email-redesign migrate" : "email-redesign migrate");

  if (!(await enumExists(prisma, "EmailStyle"))) {
    console.log("  create enum EmailStyle");
    if (!DRY_RUN) {
      await prisma.$executeRawUnsafe(
        `CREATE TYPE "EmailStyle" AS ENUM ('BRANDED', 'PLAIN')`
      );
    }
  } else {
    console.log("  skip enum EmailStyle");
  }

  await ensureColumn(
    prisma,
    "outreach_sequence_steps",
    "email_style",
    `ALTER TABLE "outreach_sequence_steps" ADD COLUMN "email_style" "EmailStyle" NOT NULL DEFAULT 'PLAIN'`
  );

  for (const [col, ddl] of [
    [
      "greeting",
      `ALTER TABLE "pitches" ADD COLUMN "greeting" TEXT`,
    ],
    [
      "intro_html",
      `ALTER TABLE "pitches" ADD COLUMN "intro_html" TEXT`,
    ],
    [
      "finding_title",
      `ALTER TABLE "pitches" ADD COLUMN "finding_title" TEXT`,
    ],
    [
      "finding_text",
      `ALTER TABLE "pitches" ADD COLUMN "finding_text" TEXT`,
    ],
    [
      "body_html",
      `ALTER TABLE "pitches" ADD COLUMN "body_html" TEXT`,
    ],
    [
      "preheader",
      `ALTER TABLE "pitches" ADD COLUMN "preheader" TEXT`,
    ],
  ]) {
    await ensureColumn(prisma, "pitches", col, ddl);
  }

  await ensureColumn(
    prisma,
    "email_outbox",
    "body_html",
    `ALTER TABLE "email_outbox" ADD COLUMN "body_html" TEXT`
  );

  await ensureColumn(
    prisma,
    "outbound_mailboxes",
    "sender_name",
    `ALTER TABLE "outbound_mailboxes" ADD COLUMN "sender_name" TEXT`
  );
  await ensureColumn(
    prisma,
    "outbound_mailboxes",
    "sender_title",
    `ALTER TABLE "outbound_mailboxes" ADD COLUMN "sender_title" TEXT`
  );
  await ensureColumn(
    prisma,
    "outbound_mailboxes",
    "sender_photo_path",
    `ALTER TABLE "outbound_mailboxes" ADD COLUMN "sender_photo_path" TEXT`
  );
  await ensureColumn(
    prisma,
    "outbound_mailboxes",
    "allow_free_mail_provider",
    `ALTER TABLE "outbound_mailboxes" ADD COLUMN "allow_free_mail_provider" BOOLEAN NOT NULL DEFAULT false`
  );

  // Cold outreach defaults: step 1 BRANDED, 2–3 PLAIN
  if (!DRY_RUN) {
    await prisma.$executeRawUnsafe(`
      UPDATE outreach_sequence_steps s
      SET email_style = 'BRANDED'
      FROM outreach_sequences seq
      WHERE s.sequence_id = seq.id
        AND seq.name = 'Cold outreach'
        AND s.step_order = 1
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE outreach_sequence_steps s
      SET email_style = 'PLAIN'
      FROM outreach_sequences seq
      WHERE s.sequence_id = seq.id
        AND seq.name = 'Cold outreach'
        AND s.step_order IN (2, 3)
    `);
  } else {
    console.log("  would set Cold outreach step styles");
  }

  console.log("done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
