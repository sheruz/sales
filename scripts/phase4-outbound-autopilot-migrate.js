/**
 * Phase 4 — Autopilot outbound email (additive).
 *
 * - EmailOutbox / OutboundMailbox enums + tables
 * - Company.timezone, SequenceEnrollment.emailAccountId
 * - OutreachSequence.isAutopilotDefault
 * - SequenceEnrollmentSource.AUTOPILOT, EmailAccountStatus.PAUSED
 *
 * Usage:
 *   DRY_RUN=1 npm run db:migrate:phase4-outbound
 *   npm run db:migrate:phase4-outbound
 *
 * Production: pg_dump before applying.
 */
const { PrismaClient } = require("@prisma/client");
require("./load-env");

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

async function tableExists(client, table) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    table
  );
  return Array.isArray(rows) && rows.length > 0;
}

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

async function indexExists(client, indexName) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1 LIMIT 1`,
    indexName
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

async function ensureEnumValue(client, enumName, value) {
  if (!(await enumExists(client, enumName))) {
    throw new Error(`Enum ${enumName} missing`);
  }
  if (await enumHasValue(client, enumName, value)) {
    console.log(`  skip enum value ${enumName}.${value}`);
    return;
  }
  console.log(`  add enum value ${enumName}.${value}`);
  if (!DRY_RUN) {
    await client.$executeRawUnsafe(
      `ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${value}'`
    );
  }
}

async function ensureEnum(client, name, values) {
  if (await enumExists(client, name)) {
    console.log(`  skip enum ${name}`);
    for (const v of values) await ensureEnumValue(client, name, v);
    return;
  }
  console.log(`  create enum ${name}`);
  if (!DRY_RUN) {
    const list = values.map((v) => `'${v}'`).join(", ");
    await client.$executeRawUnsafe(
      `CREATE TYPE "${name}" AS ENUM (${list})`
    );
  }
}

async function ensureColumn(client, table, column, ddl) {
  if (await columnExists(client, table, column)) {
    console.log(`  skip column ${table}.${column}`);
    return;
  }
  console.log(`  add column ${table}.${column}`);
  if (!DRY_RUN) {
    await client.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN ${ddl}`);
  }
}

async function ensureIndex(client, name, sql) {
  if (await indexExists(client, name)) {
    console.log(`  skip index ${name}`);
    return;
  }
  console.log(`  create index ${name}`);
  if (!DRY_RUN) await client.$executeRawUnsafe(sql);
}

async function main() {
  console.log(
    "Phase 4 — outbound autopilot migrate" + (DRY_RUN ? " (DRY_RUN)" : "")
  );

  await ensureEnum(prisma, "EmailOutboxStatus", [
    "QUEUED",
    "SENDING",
    "SENT",
    "FAILED",
    "CANCELLED",
    "HELD",
  ]);
  await ensureEnum(prisma, "OutboundMailboxStatus", [
    "ACTIVE",
    "PAUSED",
    "ERROR",
  ]);
  await ensureEnumValue(prisma, "EmailAccountStatus", "PAUSED");
  await ensureEnumValue(prisma, "SequenceEnrollmentSource", "AUTOPILOT");

  await ensureColumn(prisma, "companies", "timezone", `"timezone" TEXT`);
  await ensureColumn(
    prisma,
    "outreach_sequences",
    "is_autopilot_default",
    `"is_autopilot_default" BOOLEAN NOT NULL DEFAULT false`
  );
  await ensureColumn(
    prisma,
    "sequence_enrollments",
    "email_account_id",
    `"email_account_id" TEXT`
  );

  if (!(await tableExists(prisma, "outbound_mailboxes"))) {
    console.log("  create table outbound_mailboxes");
    if (!DRY_RUN) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "outbound_mailboxes" (
          "id" TEXT PRIMARY KEY,
          "organization_id" TEXT NOT NULL,
          "email_account_id" TEXT NOT NULL UNIQUE,
          "status" "OutboundMailboxStatus" NOT NULL DEFAULT 'ACTIVE',
          "daily_cap" INTEGER NOT NULL DEFAULT 30,
          "ramp_start" INTEGER NOT NULL DEFAULT 5,
          "ramp_increment" INTEGER NOT NULL DEFAULT 3,
          "ramp_day" INTEGER NOT NULL DEFAULT 0,
          "ramp_started_at" TIMESTAMP(3),
          "sent_today" INTEGER NOT NULL DEFAULT 0,
          "sent_today_reset_at" TIMESTAMP(3),
          "sent_total" INTEGER NOT NULL DEFAULT 0,
          "bounce_total" INTEGER NOT NULL DEFAULT 0,
          "dns_check" JSONB,
          "last_error" TEXT,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "outbound_mailboxes_organization_id_fkey"
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
          CONSTRAINT "outbound_mailboxes_email_account_id_fkey"
            FOREIGN KEY ("email_account_id") REFERENCES "email_accounts"("id") ON DELETE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "outbound_mailboxes_organization_id_status_idx"
         ON "outbound_mailboxes"("organization_id", "status")`
      );
    }
  } else {
    console.log("  skip table outbound_mailboxes");
  }

  if (!(await tableExists(prisma, "email_outbox"))) {
    console.log("  create table email_outbox");
    if (!DRY_RUN) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "email_outbox" (
          "id" TEXT PRIMARY KEY,
          "organization_id" TEXT NOT NULL,
          "enrollment_id" TEXT NOT NULL,
          "step_order" INTEGER NOT NULL,
          "contact_id" TEXT NOT NULL,
          "company_id" TEXT,
          "opportunity_id" TEXT,
          "email_account_id" TEXT NOT NULL,
          "outbound_mailbox_id" TEXT,
          "status" "EmailOutboxStatus" NOT NULL DEFAULT 'QUEUED',
          "to_email" TEXT NOT NULL,
          "subject" TEXT NOT NULL,
          "body_text" TEXT NOT NULL,
          "scheduled_for" TIMESTAMP(3),
          "held_reason" TEXT,
          "attempt_count" INTEGER NOT NULL DEFAULT 0,
          "last_error" TEXT,
          "message_id" TEXT,
          "provider_message_id" TEXT,
          "sent_at" TIMESTAMP(3),
          "idempotency_key" TEXT NOT NULL UNIQUE,
          "shadow_mode" BOOLEAN NOT NULL DEFAULT false,
          "metadata" JSONB,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "email_outbox_organization_id_fkey"
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
          CONSTRAINT "email_outbox_enrollment_id_fkey"
            FOREIGN KEY ("enrollment_id") REFERENCES "sequence_enrollments"("id") ON DELETE CASCADE,
          CONSTRAINT "email_outbox_contact_id_fkey"
            FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE,
          CONSTRAINT "email_outbox_company_id_fkey"
            FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL,
          CONSTRAINT "email_outbox_opportunity_id_fkey"
            FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL,
          CONSTRAINT "email_outbox_email_account_id_fkey"
            FOREIGN KEY ("email_account_id") REFERENCES "email_accounts"("id") ON DELETE CASCADE,
          CONSTRAINT "email_outbox_outbound_mailbox_id_fkey"
            FOREIGN KEY ("outbound_mailbox_id") REFERENCES "outbound_mailboxes"("id") ON DELETE SET NULL,
          CONSTRAINT "email_outbox_message_id_fkey"
            FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL,
          CONSTRAINT "email_outbox_enrollment_id_step_order_key"
            UNIQUE ("enrollment_id", "step_order")
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "email_outbox_organization_id_status_scheduled_for_idx"
         ON "email_outbox"("organization_id", "status", "scheduled_for")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "email_outbox_email_account_id_status_idx"
         ON "email_outbox"("email_account_id", "status")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "email_outbox_status_scheduled_for_idx"
         ON "email_outbox"("status", "scheduled_for")`
      );
    }
  } else {
    console.log("  skip table email_outbox");
  }

  if (
    (await columnExists(prisma, "sequence_enrollments", "email_account_id")) &&
    !DRY_RUN
  ) {
    // FK if missing
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "sequence_enrollments"
        ADD CONSTRAINT "sequence_enrollments_email_account_id_fkey"
        FOREIGN KEY ("email_account_id") REFERENCES "email_accounts"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
      `);
      console.log("  add FK sequence_enrollments.email_account_id");
    } catch {
      console.log("  skip FK sequence_enrollments.email_account_id");
    }
  }

  await ensureIndex(
    prisma,
    "outreach_sequences_organization_id_is_autopilot_default_idx",
    `CREATE INDEX "outreach_sequences_organization_id_is_autopilot_default_idx"
     ON "outreach_sequences"("organization_id", "is_autopilot_default")`
  );
  await ensureIndex(
    prisma,
    "sequence_enrollments_email_account_id_idx",
    `CREATE INDEX "sequence_enrollments_email_account_id_idx"
     ON "sequence_enrollments"("email_account_id")`
  );

  console.log("Phase 4 migrate done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
