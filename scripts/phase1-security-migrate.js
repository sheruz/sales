/**
 * Phase 1 Security — controlled, non-destructive tenant-isolation migration.
 *
 * Goals:
 *   - Add organization_id / is_platform_scoped columns safely
 *   - Backfill from parent resources / reliable metadata
 *   - NEVER delete historical rows
 *   - FAIL if required columns cannot be made NOT NULL (unresolved orphans)
 *   - Idempotent (safe to re-run)
 *   - Validate after apply
 *
 * Does NOT run prisma db push. Schema shape for these fields is applied here;
 * Prisma Client must already match prisma/schema.prisma (npm run db:generate).
 *
 * Usage (staging/local with DATABASE_URL — NOT against production until approved):
 *   npm run db:migrate:security
 *
 * Authoritative production strategy for this change:
 *   This script is the controlled migration for live databases that predate
 *   Prisma migrate history (prisma/migrations is empty / unused). Do not use
 *   `prisma db push` as a routine follow-up on production.
 */
const { PrismaClient } = require("@prisma/client");
require("./load-env");

const prisma = new PrismaClient();

/**
 * Job types that are demonstrably platform/system (not tenant).
 * Only these may be marked is_platform_scoped=true when organization_id is NULL.
 * Expand only with explicit evidence.
 */
const PLATFORM_JOB_TYPES = [
  "platform_health",
  "platform_cron_sweep",
  "system_maintenance",
];

class MigrationAbortError extends Error {
  constructor(message) {
    super(message);
    this.name = "MigrationAbortError";
  }
}

async function tableExists(client, table) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1
     LIMIT 1`,
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
    `SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = $1
     LIMIT 1`,
    indexName
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function constraintExists(client, constraintName) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.table_constraints
     WHERE table_schema = 'public' AND constraint_name = $1
     LIMIT 1`,
    constraintName
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function isNotNull(client, table, column) {
  const rows = await client.$queryRawUnsafe(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    table,
    column
  );
  return rows[0]?.is_nullable === "NO";
}

async function ensureColumn(client, table, column, addDdl) {
  if (await columnExists(client, table, column)) {
    console.log(`  skip column ${table}.${column} (exists)`);
    return false;
  }
  console.log(`  add column ${table}.${column}`);
  await client.$executeRawUnsafe(`ALTER TABLE "${table}" ${addDdl}`);
  return true;
}

async function ensureIndex(client, indexName, createSql) {
  if (await indexExists(client, indexName)) {
    console.log(`  skip index ${indexName} (exists)`);
    return;
  }
  console.log(`  create index ${indexName}`);
  await client.$executeRawUnsafe(createSql);
}

async function ensureFk(client, constraintName, alterSql) {
  if (await constraintExists(client, constraintName)) {
    console.log(`  skip FK ${constraintName} (exists)`);
    return;
  }
  console.log(`  add FK ${constraintName}`);
  await client.$executeRawUnsafe(alterSql);
}

async function countRows(client, table) {
  const rows = await client.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS c FROM "${table}"`
  );
  return Number(rows[0].c);
}

async function countWhere(client, sql) {
  const rows = await client.$queryRawUnsafe(sql);
  return Number(rows[0].c);
}

async function main() {
  console.log("Phase 1 security migrate (fail-closed, non-destructive)…\n");

  for (const t of [
    "notes",
    "activities",
    "job_logs",
    "ai_usage_logs",
    "organizations",
  ]) {
    if (!(await tableExists(prisma, t))) {
      throw new MigrationAbortError(`Required table missing: ${t}`);
    }
  }

  const baseline = {
    notes: await countRows(prisma, "notes"),
    activities: await countRows(prisma, "activities"),
    job_logs: await countRows(prisma, "job_logs"),
    ai_usage_logs: await countRows(prisma, "ai_usage_logs"),
  };
  console.log("Baseline row counts:", baseline);

  // ── DDL: add nullable columns (idempotent; separate from DML txn) ──────
  // PostgreSQL DDL is transactional, but we keep column-adds outside the
  // backfill txn so a validation abort does not drop newly added columns
  // on re-run (columns stay nullable until validation passes).
  console.log("\n[1] Ensure columns (nullable until validation)");
  await ensureColumn(
    prisma,
    "notes",
    "organization_id",
    `ADD COLUMN "organization_id" TEXT`
  );
  await ensureColumn(
    prisma,
    "activities",
    "organization_id",
    `ADD COLUMN "organization_id" TEXT`
  );
  await ensureColumn(
    prisma,
    "job_logs",
    "organization_id",
    `ADD COLUMN "organization_id" TEXT`
  );
  await ensureColumn(
    prisma,
    "job_logs",
    "is_platform_scoped",
    `ADD COLUMN "is_platform_scoped" BOOLEAN NOT NULL DEFAULT false`
  );
  await ensureColumn(
    prisma,
    "ai_usage_logs",
    "is_platform_scoped",
    `ADD COLUMN "is_platform_scoped" BOOLEAN NOT NULL DEFAULT false`
  );

  const hasFollowUpJobs = await tableExists(prisma, "follow_up_jobs");
  const hasSourceRuns = await tableExists(prisma, "source_runs");

  // ── Backfill + NOT NULL in one interactive transaction ──────────────────
  console.log("\n[2] Backfill + enforce NOT NULL (transaction)");
  await prisma.$transaction(
    async (tx) => {
      const notesBf = await tx.$executeRawUnsafe(`
        UPDATE notes n
        SET organization_id = l.organization_id
        FROM leads l
        WHERE n.lead_id = l.id
          AND n.organization_id IS NULL
          AND l.organization_id IS NOT NULL
      `);
      console.log(`  notes backfilled from leads: ${notesBf}`);

      const actLead = await tx.$executeRawUnsafe(`
        UPDATE activities a
        SET organization_id = l.organization_id
        FROM leads l
        WHERE a.lead_id = l.id
          AND a.organization_id IS NULL
          AND l.organization_id IS NOT NULL
      `);
      console.log(`  activities backfilled from leads: ${actLead}`);

      const actDeal = await tx.$executeRawUnsafe(`
        UPDATE activities a
        SET organization_id = d.organization_id
        FROM deals d
        WHERE a.deal_id = d.id
          AND a.organization_id IS NULL
          AND d.organization_id IS NOT NULL
      `);
      console.log(`  activities backfilled from deals: ${actDeal}`);

      // Job logs: metadata.organizationId only when it matches a real org
      const jobMeta = await tx.$executeRawUnsafe(`
        UPDATE job_logs j
        SET organization_id = o.id,
            is_platform_scoped = false
        FROM organizations o
        WHERE j.organization_id IS NULL
          AND j.metadata ? 'organizationId'
          AND coalesce(j.metadata->>'organizationId', '') <> ''
          AND o.id = j.metadata->>'organizationId'
          AND o.deleted_at IS NULL
      `);
      console.log(
        `  job_logs backfilled from metadata.organizationId: ${jobMeta}`
      );

      if (hasFollowUpJobs) {
        const jobFu = await tx.$executeRawUnsafe(`
          UPDATE job_logs j
          SET organization_id = f.organization_id,
              is_platform_scoped = false
          FROM follow_up_jobs f
          WHERE j.organization_id IS NULL
            AND j.job_id IS NOT NULL
            AND j.job_id = f.id
            AND f.organization_id IS NOT NULL
        `);
        console.log(`  job_logs backfilled from follow_up_jobs: ${jobFu}`);
      }

      if (hasSourceRuns) {
        const jobSr = await tx.$executeRawUnsafe(`
          UPDATE job_logs j
          SET organization_id = s.organization_id,
              is_platform_scoped = false
          FROM source_runs s
          WHERE j.organization_id IS NULL
            AND j.job_id IS NOT NULL
            AND j.job_id = s.id
            AND s.organization_id IS NOT NULL
        `);
        console.log(`  job_logs backfilled from source_runs: ${jobSr}`);
      }

      // Platform only for known platform job types, still org-null
      const marked = await tx.$executeRawUnsafe(
        `
        UPDATE job_logs
        SET is_platform_scoped = true
        WHERE organization_id IS NULL
          AND is_platform_scoped = false
          AND job_type = ANY($1::text[])
        `,
        PLATFORM_JOB_TYPES
      );
      console.log(
        `  job_logs marked platform-scoped (allow-listed job_type only): ${marked}`
      );

      // AI usage: tenant rows with org must not be platform-scoped.
      // NULL-org rows are left unclassified (is_platform_scoped=false) —
      // never auto-promoted to platform.
      await tx.$executeRawUnsafe(`
        UPDATE ai_usage_logs
        SET is_platform_scoped = false
        WHERE organization_id IS NOT NULL
          AND is_platform_scoped = true
      `);
      console.log(
        "  ai_usage_logs: NULL organization_id left unclassified (not auto platform)"
      );

      // Unresolved notes/activities → ABORT (no deletes)
      const unresolvedNoteCount = await countWhere(
        tx,
        `SELECT COUNT(*)::bigint AS c FROM notes WHERE organization_id IS NULL`
      );
      if (unresolvedNoteCount > 0) {
        const sample = await tx.$queryRawUnsafe(`
          SELECT id FROM notes
          WHERE organization_id IS NULL
          ORDER BY created_at
          LIMIT 50
        `);
        throw new MigrationAbortError(
          `ABORT: ${unresolvedNoteCount} notes still have NULL organization_id after backfill. ` +
            `Sample IDs: ${sample.map((r) => r.id).join(", ")}. ` +
            `Fix parent lead links, then re-run. No rows were deleted.`
        );
      }

      const unresolvedActCount = await countWhere(
        tx,
        `SELECT COUNT(*)::bigint AS c FROM activities WHERE organization_id IS NULL`
      );
      if (unresolvedActCount > 0) {
        const sample = await tx.$queryRawUnsafe(`
          SELECT id FROM activities
          WHERE organization_id IS NULL
          ORDER BY created_at
          LIMIT 50
        `);
        throw new MigrationAbortError(
          `ABORT: ${unresolvedActCount} activities still have NULL organization_id after backfill. ` +
            `Sample IDs: ${sample.map((r) => r.id).join(", ")}. ` +
            `Fix parent lead/deal links, then re-run. No rows were deleted.`
        );
      }

      const badNoteFk = await countWhere(
        tx,
        `SELECT COUNT(*)::bigint AS c FROM notes n
         WHERE n.organization_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = n.organization_id)`
      );
      const badActFk = await countWhere(
        tx,
        `SELECT COUNT(*)::bigint AS c FROM activities a
         WHERE a.organization_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = a.organization_id)`
      );
      if (badNoteFk > 0 || badActFk > 0) {
        throw new MigrationAbortError(
          `ABORT: invalid organization_id references — notes=${badNoteFk}, activities=${badActFk}`
        );
      }

      // SET NOT NULL only after unresolved count is zero
      if (!(await isNotNull(tx, "notes", "organization_id"))) {
        console.log("  ALTER notes.organization_id SET NOT NULL");
        await tx.$executeRawUnsafe(
          `ALTER TABLE notes ALTER COLUMN organization_id SET NOT NULL`
        );
      } else {
        console.log("  notes.organization_id already NOT NULL");
      }

      if (!(await isNotNull(tx, "activities", "organization_id"))) {
        console.log("  ALTER activities.organization_id SET NOT NULL");
        await tx.$executeRawUnsafe(
          `ALTER TABLE activities ALTER COLUMN organization_id SET NOT NULL`
        );
      } else {
        console.log("  activities.organization_id already NOT NULL");
      }
    },
    { timeout: 180_000, maxWait: 30_000 }
  );
  console.log("  transaction committed");

  // ── Indexes / FKs (idempotent) ─────────────────────────────────────────
  console.log("\n[3] Indexes and foreign keys");
  await ensureIndex(
    prisma,
    "notes_organization_id_idx",
    `CREATE INDEX notes_organization_id_idx ON notes (organization_id)`
  );
  await ensureIndex(
    prisma,
    "notes_organization_id_lead_id_idx",
    `CREATE INDEX notes_organization_id_lead_id_idx ON notes (organization_id, lead_id)`
  );
  await ensureFk(
    prisma,
    "notes_organization_id_fkey",
    `ALTER TABLE notes
       ADD CONSTRAINT notes_organization_id_fkey
       FOREIGN KEY (organization_id) REFERENCES organizations(id)
       ON DELETE CASCADE ON UPDATE CASCADE`
  );

  await ensureIndex(
    prisma,
    "activities_organization_id_idx",
    `CREATE INDEX activities_organization_id_idx ON activities (organization_id)`
  );
  await ensureIndex(
    prisma,
    "activities_organization_id_lead_id_idx",
    `CREATE INDEX activities_organization_id_lead_id_idx ON activities (organization_id, lead_id)`
  );
  await ensureFk(
    prisma,
    "activities_organization_id_fkey",
    `ALTER TABLE activities
       ADD CONSTRAINT activities_organization_id_fkey
       FOREIGN KEY (organization_id) REFERENCES organizations(id)
       ON DELETE CASCADE ON UPDATE CASCADE`
  );

  await ensureIndex(
    prisma,
    "job_logs_organization_id_idx",
    `CREATE INDEX job_logs_organization_id_idx ON job_logs (organization_id)`
  );
  await ensureIndex(
    prisma,
    "job_logs_organization_id_job_type_idx",
    `CREATE INDEX job_logs_organization_id_job_type_idx ON job_logs (organization_id, job_type)`
  );
  await ensureFk(
    prisma,
    "job_logs_organization_id_fkey",
    `ALTER TABLE job_logs
       ADD CONSTRAINT job_logs_organization_id_fkey
       FOREIGN KEY (organization_id) REFERENCES organizations(id)
       ON DELETE CASCADE ON UPDATE CASCADE`
  );

  // ── Post-migration validation ──────────────────────────────────────────
  console.log("\n[4] Post-migration validation");

  const nullNotes = await countWhere(
    prisma,
    `SELECT COUNT(*)::bigint AS c FROM notes WHERE organization_id IS NULL`
  );
  const nullActs = await countWhere(
    prisma,
    `SELECT COUNT(*)::bigint AS c FROM activities WHERE organization_id IS NULL`
  );
  if (nullNotes !== 0 || nullActs !== 0) {
    throw new MigrationAbortError(
      `VALIDATION FAIL: null org ids remain notes=${nullNotes} activities=${nullActs}`
    );
  }
  console.log("  ✓ notes/activities organization_id zero NULL");

  if (!(await isNotNull(prisma, "notes", "organization_id"))) {
    throw new MigrationAbortError(
      "VALIDATION FAIL: notes.organization_id not NOT NULL"
    );
  }
  if (!(await isNotNull(prisma, "activities", "organization_id"))) {
    throw new MigrationAbortError(
      "VALIDATION FAIL: activities.organization_id not NOT NULL"
    );
  }
  console.log("  ✓ notes/activities organization_id NOT NULL");

  const badNoteFk = await countWhere(
    prisma,
    `SELECT COUNT(*)::bigint AS c FROM notes n
     WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = n.organization_id)`
  );
  const badActFk = await countWhere(
    prisma,
    `SELECT COUNT(*)::bigint AS c FROM activities a
     WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = a.organization_id)`
  );
  if (badNoteFk > 0 || badActFk > 0) {
    throw new MigrationAbortError(
      `VALIDATION FAIL: org FK orphans notes=${badNoteFk} activities=${badActFk}`
    );
  }
  console.log("  ✓ organization_id values reference valid organizations");

  for (const name of [
    "notes_organization_id_idx",
    "activities_organization_id_idx",
    "job_logs_organization_id_idx",
  ]) {
    if (!(await indexExists(prisma, name))) {
      throw new MigrationAbortError(`VALIDATION FAIL: missing index ${name}`);
    }
  }
  console.log("  ✓ required indexes exist");

  for (const name of [
    "notes_organization_id_fkey",
    "activities_organization_id_fkey",
    "job_logs_organization_id_fkey",
  ]) {
    if (!(await constraintExists(prisma, name))) {
      throw new MigrationAbortError(`VALIDATION FAIL: missing FK ${name}`);
    }
  }
  console.log("  ✓ required foreign keys exist");

  const invalidJobCombo = await countWhere(
    prisma,
    `SELECT COUNT(*)::bigint AS c FROM job_logs
     WHERE organization_id IS NOT NULL AND is_platform_scoped = true`
  );
  if (invalidJobCombo > 0) {
    throw new MigrationAbortError(
      `VALIDATION FAIL: ${invalidJobCombo} job_logs have organization_id AND is_platform_scoped=true`
    );
  }
  const invalidJobFk = await countWhere(
    prisma,
    `SELECT COUNT(*)::bigint AS c FROM job_logs j
     WHERE j.organization_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = j.organization_id)`
  );
  if (invalidJobFk > 0) {
    throw new MigrationAbortError(
      `VALIDATION FAIL: ${invalidJobFk} job_logs reference missing organizations`
    );
  }

  const tenantJobs = await countWhere(
    prisma,
    `SELECT COUNT(*)::bigint AS c FROM job_logs
     WHERE organization_id IS NOT NULL AND is_platform_scoped = false`
  );
  const platformJobs = await countWhere(
    prisma,
    `SELECT COUNT(*)::bigint AS c FROM job_logs
     WHERE organization_id IS NULL AND is_platform_scoped = true`
  );
  const unclassifiedJobs = await countWhere(
    prisma,
    `SELECT COUNT(*)::bigint AS c FROM job_logs
     WHERE organization_id IS NULL AND is_platform_scoped = false`
  );
  console.log(
    `  ✓ job_logs: tenant=${tenantJobs}, platform=${platformJobs}, unclassified=${unclassifiedJobs}`
  );
  console.log(
    "    Access: tenants filter organization_id = active org; unclassified/platform never shown cross-tenant."
  );

  const badAi = await countWhere(
    prisma,
    `SELECT COUNT(*)::bigint AS c FROM ai_usage_logs
     WHERE organization_id IS NOT NULL AND is_platform_scoped = true`
  );
  if (badAi > 0) {
    throw new MigrationAbortError(
      `VALIDATION FAIL: ${badAi} ai_usage_logs have org + is_platform_scoped=true`
    );
  }
  const unclassifiedAi = await countWhere(
    prisma,
    `SELECT COUNT(*)::bigint AS c FROM ai_usage_logs
     WHERE organization_id IS NULL AND is_platform_scoped = false`
  );
  const platformAi = await countWhere(
    prisma,
    `SELECT COUNT(*)::bigint AS c FROM ai_usage_logs
     WHERE organization_id IS NULL AND is_platform_scoped = true`
  );
  console.log(
    `  ✓ ai_usage_logs: platform=${platformAi}, unclassified_null_org=${unclassifiedAi}`
  );

  const after = {
    notes: await countRows(prisma, "notes"),
    activities: await countRows(prisma, "activities"),
    job_logs: await countRows(prisma, "job_logs"),
    ai_usage_logs: await countRows(prisma, "ai_usage_logs"),
  };
  for (const k of Object.keys(baseline)) {
    if (after[k] !== baseline[k]) {
      throw new MigrationAbortError(
        `VALIDATION FAIL: row count changed for ${k}: before=${baseline[k]} after=${after[k]}`
      );
    }
  }
  console.log("  ✓ no existing records deleted (row counts unchanged)");

  console.log("\nPhase 1 security migrate complete (data preserved).");
  console.log(
    "Local/CI next: npm run db:generate && npm run test && npm run typecheck"
  );
  console.log(
    "Production: npm run db:migrate:security only (after approval). Do NOT run prisma db push."
  );
}

main()
  .catch((err) => {
    console.error("\nMigration failed:", err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
