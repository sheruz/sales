/**
 * Phase 3 Sequences — controlled, non-destructive migration.
 *
 * Adds:
 *   - sequence_enrollments
 *   - sequence_enrollment_executions
 *   - campaigns.default_sequence_id (nullable FK)
 *   - indexes + partial unique for open enrollments
 *   - sequences.view permission (idempotent)
 *
 * ID column types are DETECTED from existing tables (production uses TEXT PKs,
 * not UUID). Do not hardcode UUID FKs.
 *
 * Does NOT delete Lead/CampaignLead/FollowUpJob data.
 * Does NOT run prisma db push.
 *
 * Usage:
 *   npm run db:migrate:sequences
 */
const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("crypto");
require("./load-env");

const prisma = new PrismaClient();

class MigrationAbortError extends Error {
  constructor(message) {
    super(message);
    this.name = "MigrationAbortError";
  }
}

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

async function ensureEnum(client, name, values) {
  if (await enumExists(client, name)) {
    console.log(`  skip enum ${name}`);
    return;
  }
  console.log(`  create enum ${name}`);
  const list = values.map((v) => `'${v}'`).join(", ");
  await client.$executeRawUnsafe(`CREATE TYPE "${name}" AS ENUM (${list})`);
}

async function countTable(client, table) {
  if (!(await tableExists(client, table))) return 0;
  const rows = await client.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM ${table}`
  );
  return rows[0]?.c ?? 0;
}

/**
 * Resolve SQL type for id columns from an existing table.
 * Production (safe-migrate-tenancy) uses TEXT; some envs may use uuid.
 */
async function getIdSqlType(client, table, column = "id") {
  const rows = await client.$queryRawUnsafe(
    `SELECT data_type, udt_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     LIMIT 1`,
    table,
    column
  );
  if (!rows.length) {
    throw new MigrationAbortError(
      `Cannot detect type: ${table}.${column} missing — run prior migrations first`
    );
  }
  const { data_type: dataType, udt_name: udt } = rows[0];
  if (dataType === "uuid" || udt === "uuid") return "UUID";
  // character varying / text
  return "TEXT";
}

function idDefaultExpr(sqlType) {
  // Works for both UUID and TEXT PKs on Postgres
  return sqlType === "UUID"
    ? "gen_random_uuid()"
    : "(gen_random_uuid()::text)";
}

async function main() {
  console.log("Phase 3 sequences migrate — start");

  try {
    await prisma.$executeRawUnsafe(
      `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`
    );
  } catch {
    console.log(
      "  note: pgcrypto extension skipped (may already exist / insufficient privileges)"
    );
  }

  // Required parent tables
  for (const t of [
    "organizations",
    "campaigns",
    "outreach_sequences",
    "contacts",
    "leads",
    "users",
  ]) {
    if (!(await tableExists(prisma, t))) {
      throw new MigrationAbortError(`Required table missing: ${t}`);
    }
  }
  // opportunities / messages may be empty but should exist in Phase 2+ schema
  if (!(await tableExists(prisma, "opportunities"))) {
    throw new MigrationAbortError("Required table missing: opportunities");
  }
  if (!(await tableExists(prisma, "messages"))) {
    throw new MigrationAbortError("Required table missing: messages");
  }

  const orgIdType = await getIdSqlType(prisma, "organizations", "id");
  const campaignIdType = await getIdSqlType(prisma, "campaigns", "id");
  const sequenceIdType = await getIdSqlType(prisma, "outreach_sequences", "id");
  const contactIdType = await getIdSqlType(prisma, "contacts", "id");
  const leadIdType = await getIdSqlType(prisma, "leads", "id");
  const userIdType = await getIdSqlType(prisma, "users", "id");
  const opportunityIdType = await getIdSqlType(prisma, "opportunities", "id");
  const messageIdType = await getIdSqlType(prisma, "messages", "id");
  const permissionIdType = (await tableExists(prisma, "permissions"))
    ? await getIdSqlType(prisma, "permissions", "id")
    : "TEXT";

  console.log("  detected id types:", {
    organizations: orgIdType,
    campaigns: campaignIdType,
    outreach_sequences: sequenceIdType,
    contacts: contactIdType,
    leads: leadIdType,
    users: userIdType,
    opportunities: opportunityIdType,
    messages: messageIdType,
  });

  // Enrollment PK follows org id type (TEXT on production)
  const enrollIdType = orgIdType;
  const enrollIdDefault = idDefaultExpr(enrollIdType);

  const before = {
    campaigns: await countTable(prisma, "campaigns"),
    outreach_sequences: await countTable(prisma, "outreach_sequences"),
    campaign_leads: await countTable(prisma, "campaign_leads"),
    follow_up_jobs: await countTable(prisma, "follow_up_jobs"),
    leads: await countTable(prisma, "leads"),
  };
  console.log("  row counts before:", before);

  console.log("\n1) Enums");
  await ensureEnum(prisma, "SequenceEnrollmentStatus", [
    "PENDING",
    "ACTIVE",
    "PROCESSING",
    "PAUSED",
    "COMPLETED",
    "STOPPED",
    "FAILED",
  ]);
  await ensureEnum(prisma, "SequenceEnrollmentStopReason", [
    "REPLIED",
    "UNSUBSCRIBED",
    "BOUNCED",
    "SUPPRESSED",
    "CONTACT_INVALID",
    "OPPORTUNITY_CLOSED",
    "MEETING_BOOKED",
    "MANUAL",
    "SEQUENCE_INACTIVE",
    "CAMPAIGN_INACTIVE",
    "COMPLETED_NATURALLY",
    "MAX_RETRIES",
    "OTHER",
  ]);
  await ensureEnum(prisma, "SequenceExecutionStatus", [
    "SUCCESS",
    "FAILED",
    "SKIPPED",
  ]);

  console.log("\n2) sequence_enrollments table");
  if (!(await tableExists(prisma, "sequence_enrollments"))) {
    console.log(`  create sequence_enrollments (id ${enrollIdType})`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE sequence_enrollments (
        id ${enrollIdType} PRIMARY KEY DEFAULT ${enrollIdDefault},
        organization_id ${orgIdType} NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        sequence_id ${sequenceIdType} NOT NULL REFERENCES outreach_sequences(id) ON DELETE CASCADE,
        campaign_id ${campaignIdType} REFERENCES campaigns(id) ON DELETE SET NULL,
        opportunity_id ${opportunityIdType} REFERENCES opportunities(id) ON DELETE SET NULL,
        contact_id ${contactIdType} NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        lead_id ${leadIdType} REFERENCES leads(id) ON DELETE SET NULL,
        status "SequenceEnrollmentStatus" NOT NULL DEFAULT 'PENDING',
        current_step_order INT NOT NULL DEFAULT 0,
        next_run_at TIMESTAMPTZ,
        started_at TIMESTAMPTZ,
        paused_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        stopped_at TIMESTAMPTZ,
        stop_reason "SequenceEnrollmentStopReason",
        last_executed_at TIMESTAMPTZ,
        last_error TEXT,
        retry_count INT NOT NULL DEFAULT 0,
        max_retries INT NOT NULL DEFAULT 3,
        claimed_at TIMESTAMPTZ,
        claim_token TEXT,
        enrolled_by_id ${userIdType} REFERENCES users(id) ON DELETE SET NULL,
        idempotency_key TEXT UNIQUE,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  } else {
    console.log("  skip sequence_enrollments (exists)");
  }

  console.log("\n3) sequence_enrollment_executions table");
  if (!(await tableExists(prisma, "sequence_enrollment_executions"))) {
    const execIdType = enrollIdType;
    const execIdDefault = idDefaultExpr(execIdType);
    const enrollmentIdType = await getIdSqlType(
      prisma,
      "sequence_enrollments",
      "id"
    );
    console.log(`  create sequence_enrollment_executions (id ${execIdType})`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE sequence_enrollment_executions (
        id ${execIdType} PRIMARY KEY DEFAULT ${execIdDefault},
        organization_id ${orgIdType} NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        enrollment_id ${enrollmentIdType} NOT NULL REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
        step_order INT NOT NULL,
        status "SequenceExecutionStatus" NOT NULL,
        message_id ${messageIdType} REFERENCES messages(id) ON DELETE SET NULL,
        error TEXT,
        idempotency_key TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        metadata JSONB
      )
    `);
  } else {
    console.log("  skip sequence_enrollment_executions (exists)");
  }

  console.log("\n4) campaigns.default_sequence_id");
  if (!(await columnExists(prisma, "campaigns", "default_sequence_id"))) {
    console.log(
      `  add campaigns.default_sequence_id (${sequenceIdType})`
    );
    await prisma.$executeRawUnsafe(`
      ALTER TABLE campaigns
      ADD COLUMN default_sequence_id ${sequenceIdType}
      REFERENCES outreach_sequences(id) ON DELETE SET NULL
    `);
  } else {
    console.log("  skip campaigns.default_sequence_id");
  }

  console.log("\n5) Indexes");
  const indexes = [
    [
      "sequence_enrollments_organization_id_idx",
      `CREATE INDEX sequence_enrollments_organization_id_idx ON sequence_enrollments (organization_id)`,
    ],
    [
      "sequence_enrollments_sequence_id_idx",
      `CREATE INDEX sequence_enrollments_sequence_id_idx ON sequence_enrollments (sequence_id)`,
    ],
    [
      "sequence_enrollments_campaign_id_idx",
      `CREATE INDEX sequence_enrollments_campaign_id_idx ON sequence_enrollments (campaign_id)`,
    ],
    [
      "sequence_enrollments_opportunity_id_idx",
      `CREATE INDEX sequence_enrollments_opportunity_id_idx ON sequence_enrollments (opportunity_id)`,
    ],
    [
      "sequence_enrollments_contact_id_idx",
      `CREATE INDEX sequence_enrollments_contact_id_idx ON sequence_enrollments (contact_id)`,
    ],
    [
      "sequence_enrollments_status_next_run_at_idx",
      `CREATE INDEX sequence_enrollments_status_next_run_at_idx ON sequence_enrollments (status, next_run_at)`,
    ],
    [
      "sequence_enrollments_org_status_next_run_idx",
      `CREATE INDEX sequence_enrollments_org_status_next_run_idx ON sequence_enrollments (organization_id, status, next_run_at)`,
    ],
    [
      "sequence_enrollment_executions_enrollment_id_idx",
      `CREATE INDEX sequence_enrollment_executions_enrollment_id_idx ON sequence_enrollment_executions (enrollment_id)`,
    ],
    [
      "campaigns_default_sequence_id_idx",
      `CREATE INDEX campaigns_default_sequence_id_idx ON campaigns (default_sequence_id)`,
    ],
  ];

  for (const [name, ddl] of indexes) {
    if (await indexExists(prisma, name)) {
      console.log(`  skip index ${name}`);
    } else {
      console.log(`  create index ${name}`);
      await prisma.$executeRawUnsafe(ddl);
    }
  }

  const partialName = "sequence_enrollments_open_org_seq_contact_uidx";
  if (!(await indexExists(prisma, partialName))) {
    console.log(`  create partial unique ${partialName}`);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX ${partialName}
      ON sequence_enrollments (organization_id, sequence_id, contact_id)
      WHERE status IN ('PENDING', 'ACTIVE', 'PROCESSING', 'PAUSED')
    `);
  } else {
    console.log(`  skip ${partialName}`);
  }

  console.log("\n6) Permission sequences.view (idempotent)");
  if (await tableExists(prisma, "permissions")) {
    const permId =
      permissionIdType === "UUID" ? randomUUID() : randomUUID();
    // Use parameterized insert via Prisma to avoid type mismatch on permissions.id
    await prisma.$executeRawUnsafe(
      `INSERT INTO permissions (id, key, name, created_at, updated_at)
       VALUES ($1, 'sequences.view', 'sequences.view', NOW(), NOW())
       ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
      permId
    );
    await prisma.$executeRawUnsafe(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r
      CROSS JOIN permissions p
      WHERE p.key = 'sequences.view'
        AND r.key IN ('sales_rep', 'sales_manager', 'company_admin', 'platform_admin')
      ON CONFLICT DO NOTHING
    `);
    console.log("  sequences.view seeded for enroll-capable roles");
  } else {
    console.log("  skip permissions (table missing — run seed separately)");
  }

  const after = {
    campaigns: await countTable(prisma, "campaigns"),
    outreach_sequences: await countTable(prisma, "outreach_sequences"),
    campaign_leads: await countTable(prisma, "campaign_leads"),
    follow_up_jobs: await countTable(prisma, "follow_up_jobs"),
    leads: await countTable(prisma, "leads"),
  };

  for (const key of Object.keys(before)) {
    if (before[key] !== after[key]) {
      throw new MigrationAbortError(
        `Row count changed for ${key}: ${before[key]} → ${after[key]}`
      );
    }
  }

  if (!(await tableExists(prisma, "sequence_enrollments"))) {
    throw new MigrationAbortError("sequence_enrollments was not created");
  }
  if (!(await tableExists(prisma, "sequence_enrollment_executions"))) {
    throw new MigrationAbortError(
      "sequence_enrollment_executions was not created"
    );
  }

  console.log("\n7) Validation OK — legacy row counts unchanged");
  console.log("  row counts after:", after);
  console.log("Phase 3 sequences migrate — complete");
}

main()
  .catch((err) => {
    console.error("\nPhase 3 sequences migrate FAILED:", err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
