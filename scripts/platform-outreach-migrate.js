/**
 * Super Admin Outreach tables (templates + campaigns).
 *
 *   DRY_RUN=1 node scripts/run-with-env.js node scripts/platform-outreach-migrate.js
 *   node scripts/run-with-env.js node scripts/platform-outreach-migrate.js
 */
/* eslint-disable @typescript-eslint/no-require-imports */
require("./load-env");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

async function tableExists(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    table
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function exec(sql) {
  console.log(`  ${DRY_RUN ? "DRY " : ""}${sql.split("\n")[0].slice(0, 100)}…`);
  if (!DRY_RUN) await prisma.$executeRawUnsafe(sql);
}

async function main() {
  console.log(`Platform outreach migrate${DRY_RUN ? " (DRY_RUN)" : ""}`);

  if (!(await tableExists("platform_outreach_templates"))) {
    await exec(`
CREATE TABLE "platform_outreach_templates" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body_text" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
    await exec(
      `CREATE INDEX "platform_outreach_templates_category_active_idx"
       ON "platform_outreach_templates"("category", "active")`
    );
  } else {
    console.log("  platform_outreach_templates exists");
  }

  if (!(await tableExists("platform_outreach_campaigns"))) {
    await exec(`
CREATE TABLE "platform_outreach_campaigns" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "audience_mode" TEXT NOT NULL DEFAULT 'mixed',
  "has_website_template_id" TEXT,
  "no_website_template_id" TEXT,
  "follow_up_template_id" TEXT,
  "follow_up_delay_days" INTEGER NOT NULL DEFAULT 4,
  "email_account_id" TEXT,
  "rotate_accounts" BOOLEAN NOT NULL DEFAULT false,
  "send_cap" INTEGER NOT NULL DEFAULT 50,
  "sent_count" INTEGER NOT NULL DEFAULT 0,
  "scheduled_mode" TEXT NOT NULL DEFAULT 'window',
  "filters" JSONB,
  "paused_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_by_user_id" TEXT,
  "has_website_sequence_id" TEXT,
  "no_website_sequence_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_outreach_campaigns_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
)`);
    await exec(
      `CREATE INDEX "platform_outreach_campaigns_organization_id_status_idx"
       ON "platform_outreach_campaigns"("organization_id", "status")`
    );
  } else {
    console.log("  platform_outreach_campaigns exists");
  }

  if (!(await tableExists("platform_outreach_campaign_recipients"))) {
    await exec(`
CREATE TABLE "platform_outreach_campaign_recipients" (
  "id" TEXT PRIMARY KEY,
  "campaign_id" TEXT NOT NULL,
  "contact_id" TEXT NOT NULL,
  "company_id" TEXT,
  "template_kind" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body_text" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "skip_reason" TEXT,
  "enrollment_id" TEXT,
  "outbox_id" TEXT,
  "edited" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_outreach_campaign_recipients_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "platform_outreach_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE
)`);
    await exec(
      `CREATE UNIQUE INDEX "platform_outreach_campaign_recipients_campaign_id_contact_id_key"
       ON "platform_outreach_campaign_recipients"("campaign_id", "contact_id")`
    );
    await exec(
      `CREATE INDEX "platform_outreach_campaign_recipients_campaign_id_status_idx"
       ON "platform_outreach_campaign_recipients"("campaign_id", "status")`
    );
  } else {
    console.log("  platform_outreach_campaign_recipients exists");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
