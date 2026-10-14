/**
 * Phase 5 — AI reply agent (additive).
 *
 * - MessageAiClassification Phase 5 values (legacy kept)
 * - OpportunityStage.POSITIVE_REPLY
 * - Timeline / OpportunityEvent types
 * - EmailOutbox purpose + nullable enrollment/step + inboundMessageId unique
 * - CHECK constraints for purpose
 * - AiReplyDraft + Notification tables
 * - Message / InboxConversation AI fields
 *
 * Usage:
 *   DRY_RUN=1 npm run db:migrate:phase5-ai-reply
 *   npm run db:migrate:phase5-ai-reply
 *
 * Enum ADD VALUE runs outside a transaction (Postgres requirement). Idempotent.
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

async function constraintExists(client, name) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1 FROM pg_constraint WHERE conname = $1 LIMIT 1`,
    name
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

/** Enum adds must NOT run inside a transaction. */
async function ensureEnumValue(client, enumName, value) {
  if (!(await enumExists(client, enumName))) {
    console.log(`  skip enum value (type missing) ${enumName}.${value}`);
    return;
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

async function ensureCheck(client, name, table, expr) {
  if (await constraintExists(client, name)) {
    console.log(`  skip check ${name}`);
    return;
  }
  console.log(`  add check ${name}`);
  if (!DRY_RUN) {
    await client.$executeRawUnsafe(
      `ALTER TABLE "${table}" ADD CONSTRAINT "${name}" CHECK (${expr})`
    );
  }
}

async function main() {
  console.log(
    "Phase 5 — AI reply agent migrate" + (DRY_RUN ? " (DRY_RUN)" : "")
  );

  // ── Enums (outside transaction) ──────────────────────────────────────────
  await ensureEnum(prisma, "EmailOutboxPurpose", ["SEQUENCE", "AI_REPLY"]);
  await ensureEnum(prisma, "AiReplyStatus", [
    "DRAFT",
    "HELD",
    "QUEUED",
    "SENT",
    "CANCELLED",
    "DISMISSED",
  ]);
  await ensureEnum(prisma, "AiReplyMode", ["OFF", "DRAFT_ONLY", "AUTO_SEND"]);
  await ensureEnum(prisma, "NotificationType", [
    "AI_HELD",
    "INTERESTED_REPLY",
    "REFERRAL_CREATED",
    "DAILY_HELD_DIGEST",
  ]);

  for (const v of [
    "NOT_NOW",
    "NOT_INTERESTED",
    "WRONG_PERSON",
    "OTHER",
  ]) {
    await ensureEnumValue(prisma, "MessageAiClassification", v);
  }

  await ensureEnumValue(prisma, "OpportunityStage", "POSITIVE_REPLY");
  await ensureEnumValue(prisma, "OpportunityEventType", "POSITIVE_REPLY");

  for (const v of [
    "REPLY_RECEIVED",
    "REPLY_CLASSIFIED",
    "AI_DRAFTED",
    "AI_SENT",
    "HELD_FOR_HUMAN",
    "HUMAN_SENT",
    "FOLLOWUP_SCHEDULED",
    "REFERRAL_CREATED",
  ]) {
    await ensureEnumValue(prisma, "CompanyTimelineEventType", v);
  }

  // ── Email outbox alterations ─────────────────────────────────────────────
  if (await tableExists(prisma, "email_outbox")) {
    await ensureColumn(
      prisma,
      "email_outbox",
      "purpose",
      `"purpose" "EmailOutboxPurpose" NOT NULL DEFAULT 'SEQUENCE'`
    );
    await ensureColumn(
      prisma,
      "email_outbox",
      "inbound_message_id",
      `"inbound_message_id" TEXT`
    );
    await ensureColumn(
      prisma,
      "email_outbox",
      "in_reply_to",
      `"in_reply_to" TEXT`
    );
    await ensureColumn(
      prisma,
      "email_outbox",
      "references_header",
      `"references_header" TEXT`
    );

    // Make enrollment_id / step_order nullable (keep unique)
    if (!DRY_RUN) {
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "email_outbox" ALTER COLUMN "enrollment_id" DROP NOT NULL`
        );
        console.log("  nullable email_outbox.enrollment_id");
      } catch (e) {
        console.log(
          "  skip nullable enrollment_id:",
          e instanceof Error ? e.message : e
        );
      }
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "email_outbox" ALTER COLUMN "step_order" DROP NOT NULL`
        );
        console.log("  nullable email_outbox.step_order");
      } catch (e) {
        console.log(
          "  skip nullable step_order:",
          e instanceof Error ? e.message : e
        );
      }
    } else {
      console.log("  DRY_RUN would make enrollment_id/step_order nullable");
    }

    await ensureIndex(
      prisma,
      "email_outbox_inbound_message_id_key",
      `CREATE UNIQUE INDEX "email_outbox_inbound_message_id_key"
       ON "email_outbox"("inbound_message_id")`
    );
    await ensureIndex(
      prisma,
      "email_outbox_purpose_status_idx",
      `CREATE INDEX "email_outbox_purpose_status_idx"
       ON "email_outbox"("purpose", "status")`
    );

    // Keep @@unique([enrollmentId, stepOrder]) — do NOT drop
    await ensureCheck(
      prisma,
      "email_outbox_purpose_fields_check",
      "email_outbox",
      `(
        ("purpose" = 'SEQUENCE' AND "enrollment_id" IS NOT NULL AND "step_order" IS NOT NULL)
        OR
        ("purpose" = 'AI_REPLY' AND "inbound_message_id" IS NOT NULL)
      )`
    );

    if (!DRY_RUN) {
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "email_outbox"
          ADD CONSTRAINT "email_outbox_inbound_message_id_fkey"
          FOREIGN KEY ("inbound_message_id") REFERENCES "messages"("id")
          ON DELETE SET NULL ON UPDATE CASCADE
        `);
        console.log("  add FK email_outbox.inbound_message_id");
      } catch {
        console.log("  skip FK email_outbox.inbound_message_id");
      }
    }
  } else {
    console.log("  skip email_outbox (missing — run Phase 4 migrate first)");
  }

  // ── Messages ─────────────────────────────────────────────────────────────
  if (await tableExists(prisma, "messages")) {
    await ensureColumn(
      prisma,
      "messages",
      "ai_reasoning_summary",
      `"ai_reasoning_summary" TEXT`
    );
    await ensureColumn(
      prisma,
      "messages",
      "ai_confidence",
      `"ai_confidence" DECIMAL(4,3)`
    );
    await ensureColumn(prisma, "messages", "ai_model", `"ai_model" TEXT`);
    await ensureColumn(
      prisma,
      "messages",
      "ai_cost",
      `"ai_cost" DECIMAL(10,6)`
    );
    await ensureColumn(
      prisma,
      "messages",
      "hold_reason",
      `"hold_reason" TEXT`
    );
    await ensureColumn(
      prisma,
      "messages",
      "sent_by_ai",
      `"sent_by_ai" BOOLEAN NOT NULL DEFAULT false`
    );
    await ensureIndex(
      prisma,
      "messages_ai_classification_idx",
      `CREATE INDEX "messages_ai_classification_idx" ON "messages"("ai_classification")`
    );
  }

  // ── Inbox conversations ──────────────────────────────────────────────────
  if (await tableExists(prisma, "inbox_conversations")) {
    await ensureColumn(
      prisma,
      "inbox_conversations",
      "latest_class",
      `"latest_class" "MessageAiClassification"`
    );
    await ensureColumn(
      prisma,
      "inbox_conversations",
      "latest_confidence",
      `"latest_confidence" DECIMAL(4,3)`
    );
    await ensureColumn(
      prisma,
      "inbox_conversations",
      "hold_reason",
      `"hold_reason" TEXT`
    );
    await ensureColumn(
      prisma,
      "inbox_conversations",
      "ai_reply_count",
      `"ai_reply_count" INTEGER NOT NULL DEFAULT 0`
    );
    await ensureColumn(
      prisma,
      "inbox_conversations",
      "ooo_until",
      `"ooo_until" TIMESTAMP(3)`
    );
    await ensureIndex(
      prisma,
      "inbox_conversations_latest_class_idx",
      `CREATE INDEX "inbox_conversations_latest_class_idx"
       ON "inbox_conversations"("latest_class")`
    );
  }

  // ── Ai reply drafts ──────────────────────────────────────────────────────
  if (!(await tableExists(prisma, "ai_reply_drafts"))) {
    console.log("  create table ai_reply_drafts");
    if (!DRY_RUN) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "ai_reply_drafts" (
          "id" TEXT PRIMARY KEY,
          "organization_id" TEXT NOT NULL,
          "conversation_id" TEXT NOT NULL,
          "inbound_message_id" TEXT NOT NULL UNIQUE,
          "outbox_id" TEXT,
          "outbound_message_id" TEXT,
          "status" "AiReplyStatus" NOT NULL DEFAULT 'DRAFT',
          "class" "MessageAiClassification" NOT NULL,
          "confidence" DECIMAL(4,3) NOT NULL,
          "hold_reason" TEXT,
          "reply_text" TEXT NOT NULL,
          "offers_booking" BOOLEAN NOT NULL DEFAULT false,
          "classify_model" TEXT,
          "draft_model" TEXT,
          "classify_cost" DECIMAL(10,6),
          "draft_cost" DECIMAL(10,6),
          "scheduled_for" TIMESTAMP(3),
          "human_override_class" "MessageAiClassification",
          "dismissed_at" TIMESTAMP(3),
          "metadata" JSONB,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ai_reply_drafts_organization_id_fkey"
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
          CONSTRAINT "ai_reply_drafts_conversation_id_fkey"
            FOREIGN KEY ("conversation_id") REFERENCES "inbox_conversations"("id") ON DELETE CASCADE,
          CONSTRAINT "ai_reply_drafts_inbound_message_id_fkey"
            FOREIGN KEY ("inbound_message_id") REFERENCES "messages"("id") ON DELETE CASCADE,
          CONSTRAINT "ai_reply_drafts_outbound_message_id_fkey"
            FOREIGN KEY ("outbound_message_id") REFERENCES "messages"("id") ON DELETE SET NULL,
          CONSTRAINT "ai_reply_drafts_outbox_id_fkey"
            FOREIGN KEY ("outbox_id") REFERENCES "email_outbox"("id") ON DELETE SET NULL
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "ai_reply_drafts_organization_id_status_idx"
         ON "ai_reply_drafts"("organization_id", "status")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "ai_reply_drafts_conversation_id_idx"
         ON "ai_reply_drafts"("conversation_id")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "ai_reply_drafts_status_scheduled_for_idx"
         ON "ai_reply_drafts"("status", "scheduled_for")`
      );
    }
  } else {
    console.log("  skip table ai_reply_drafts");
  }

  // ── Notifications ────────────────────────────────────────────────────────
  if (!(await tableExists(prisma, "notifications"))) {
    console.log("  create table notifications");
    if (!DRY_RUN) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "notifications" (
          "id" TEXT PRIMARY KEY,
          "organization_id" TEXT NOT NULL,
          "user_id" TEXT NOT NULL,
          "type" "NotificationType" NOT NULL,
          "title" TEXT NOT NULL,
          "body" TEXT NOT NULL,
          "href" TEXT,
          "read_at" TIMESTAMP(3),
          "email_sent_at" TIMESTAMP(3),
          "metadata" JSONB,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "notifications_organization_id_fkey"
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
          CONSTRAINT "notifications_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "notifications_organization_id_user_id_read_at_idx"
         ON "notifications"("organization_id", "user_id", "read_at")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "notifications_user_id_created_at_idx"
         ON "notifications"("user_id", "created_at")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "notifications_type_created_at_idx"
         ON "notifications"("type", "created_at")`
      );
    }
  } else {
    console.log("  skip table notifications");
  }

  console.log("Phase 5 migrate done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
