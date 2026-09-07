/**
 * Phase 4 Campaign / Sequence Builder — controlled, non-destructive migration.
 *
 * Adds:
 *   - SequenceEnrollmentSource enum
 *   - sequence_enrollments.source
 *   - sequence_enrollments.campaign_lead_id (unique FK)
 *   - sequence_enrollments.steps_snapshot (JSONB)
 *   - campaign_leads.bridged_at
 *   - supporting indexes
 *
 * Does NOT delete Lead / CampaignLead / FollowUpJob data.
 * Does NOT run prisma db push.
 *
 * Usage:
 *   npm run db:migrate:campaigns
 */
const { PrismaClient } = require("@prisma/client");
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
  return "TEXT";
}

async function fkExists(client, table, column) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1
     FROM information_schema.key_column_usage k
     JOIN information_schema.table_constraints c
       ON c.constraint_name = k.constraint_name
      AND c.table_schema = k.table_schema
     WHERE k.table_schema = 'public'
       AND k.table_name = $1
       AND k.column_name = $2
       AND c.constraint_type = 'FOREIGN KEY'
     LIMIT 1`,
    table,
    column
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function main() {
  console.log("Phase 4 campaign migrate — start");

  for (const t of [
    "organizations",
    "campaigns",
    "campaign_leads",
    "sequence_enrollments",
    "outreach_sequences",
    "leads",
    "follow_up_jobs",
  ]) {
    if (!(await tableExists(prisma, t))) {
      throw new MigrationAbortError(
        `Required table missing: ${t} — run Phase 3 migrate first`
      );
    }
  }

  const campaignLeadIdType = await getIdSqlType(prisma, "campaign_leads", "id");
  console.log("  detected campaign_leads.id type:", campaignLeadIdType);

  const before = {
    campaigns: await countTable(prisma, "campaigns"),
    campaign_leads: await countTable(prisma, "campaign_leads"),
    sequence_enrollments: await countTable(prisma, "sequence_enrollments"),
    follow_up_jobs: await countTable(prisma, "follow_up_jobs"),
    leads: await countTable(prisma, "leads"),
    outreach_sequences: await countTable(prisma, "outreach_sequences"),
  };
  console.log("  row counts before:", before);

  console.log("\n1) SequenceEnrollmentSource enum");
  await ensureEnum(prisma, "SequenceEnrollmentSource", [
    "MANUAL",
    "CAMPAIGN",
    "CAMPAIGN_LEAD_BRIDGE",
  ]);

  console.log("\n2) sequence_enrollments.source");
  if (!(await columnExists(prisma, "sequence_enrollments", "source"))) {
    console.log("  add sequence_enrollments.source");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE sequence_enrollments
      ADD COLUMN source "SequenceEnrollmentSource" NOT NULL DEFAULT 'MANUAL'
    `);
  } else {
    console.log("  skip sequence_enrollments.source");
  }

  console.log("\n3) sequence_enrollments.steps_snapshot");
  if (!(await columnExists(prisma, "sequence_enrollments", "steps_snapshot"))) {
    console.log("  add sequence_enrollments.steps_snapshot");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE sequence_enrollments
      ADD COLUMN steps_snapshot JSONB
    `);
  } else {
    console.log("  skip sequence_enrollments.steps_snapshot");
  }

  console.log("\n4) sequence_enrollments.campaign_lead_id");
  if (!(await columnExists(prisma, "sequence_enrollments", "campaign_lead_id"))) {
    console.log(
      `  add sequence_enrollments.campaign_lead_id (${campaignLeadIdType})`
    );
    await prisma.$executeRawUnsafe(`
      ALTER TABLE sequence_enrollments
      ADD COLUMN campaign_lead_id ${campaignLeadIdType}
    `);
  } else {
    console.log("  skip sequence_enrollments.campaign_lead_id column");
  }

  if (
    (await columnExists(prisma, "sequence_enrollments", "campaign_lead_id")) &&
    !(await fkExists(prisma, "sequence_enrollments", "campaign_lead_id"))
  ) {
    console.log("  add FK sequence_enrollments.campaign_lead_id → campaign_leads");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE sequence_enrollments
      ADD CONSTRAINT sequence_enrollments_campaign_lead_id_fkey
      FOREIGN KEY (campaign_lead_id) REFERENCES campaign_leads(id) ON DELETE SET NULL
    `);
  } else {
    console.log("  skip campaign_lead_id FK");
  }

  console.log("\n5) campaign_leads.bridged_at");
  if (!(await columnExists(prisma, "campaign_leads", "bridged_at"))) {
    console.log("  add campaign_leads.bridged_at");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE campaign_leads
      ADD COLUMN bridged_at TIMESTAMPTZ
    `);
  } else {
    console.log("  skip campaign_leads.bridged_at");
  }

  console.log("\n6) Indexes");
  const indexes = [
    [
      "sequence_enrollments_source_idx",
      `CREATE INDEX sequence_enrollments_source_idx ON sequence_enrollments (source)`,
    ],
    [
      "sequence_enrollments_campaign_lead_id_key",
      `CREATE UNIQUE INDEX sequence_enrollments_campaign_lead_id_key
       ON sequence_enrollments (campaign_lead_id)
       WHERE campaign_lead_id IS NOT NULL`,
    ],
    [
      "campaign_leads_bridged_at_idx",
      `CREATE INDEX campaign_leads_bridged_at_idx ON campaign_leads (bridged_at)`,
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

  // Validate FK orphans (should be none for new nullable column)
  const unresolved = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS c
    FROM sequence_enrollments se
    WHERE se.campaign_lead_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM campaign_leads cl WHERE cl.id = se.campaign_lead_id
      )
  `);
  const unresolvedCount = unresolved[0]?.c ?? 0;
  if (unresolvedCount > 0) {
    throw new MigrationAbortError(
      `Unresolved campaign_lead_id FKs: ${unresolvedCount}`
    );
  }
  console.log("  FK validation: 0 unresolved campaign_lead_id refs");

  const after = {
    campaigns: await countTable(prisma, "campaigns"),
    campaign_leads: await countTable(prisma, "campaign_leads"),
    sequence_enrollments: await countTable(prisma, "sequence_enrollments"),
    follow_up_jobs: await countTable(prisma, "follow_up_jobs"),
    leads: await countTable(prisma, "leads"),
    outreach_sequences: await countTable(prisma, "outreach_sequences"),
  };

  for (const key of Object.keys(before)) {
    if (before[key] !== after[key]) {
      throw new MigrationAbortError(
        `Row count changed for ${key}: ${before[key]} → ${after[key]}`
      );
    }
  }

  console.log("\n  row counts after (unchanged):", after);
  console.log("Phase 4 campaign migrate — OK");
}

main()
  .catch((err) => {
    console.error("Phase 4 campaign migrate FAILED:", err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
