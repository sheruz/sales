/**
 * Phase 5 — backfill SequenceEnrollment.stepsSnapshot for enrollments that lack one.
 *
 * - Never overwrites an existing non-empty snapshot
 * - Dry-run by default when --dry-run is passed (or without --execute)
 * - Org-scoped when --organizationId=... is provided
 *
 * Usage:
 *   npm run db:backfill:sequence-snapshots -- --dry-run
 *   npm run db:backfill:sequence-snapshots -- --execute
 *   npm run db:backfill:sequence-snapshots -- --execute --organizationId=<uuid>
 *
 * Also ensures additive `campaigns.view` permission + role links (idempotent).
 */
const { randomUUID } = require("crypto");
const { PrismaClient } = require("@prisma/client");
require("./load-env");

const prisma = new PrismaClient();

function parseArgs(argv) {
  const flags = new Set();
  const opts = {};
  for (const a of argv) {
    if (a.startsWith("--organizationId=")) {
      opts.organizationId = a.slice("--organizationId=".length);
    } else if (a.startsWith("--limit=")) {
      opts.limit = Number(a.slice("--limit=".length));
    } else if (a.startsWith("--")) {
      flags.add(a.slice(2));
    }
  }
  return { flags, opts };
}

function snapshotSteps(steps) {
  return (steps || []).map((s) => ({
    stepOrder: s.stepOrder,
    delayMinutes: s.delayMinutes,
    channel: s.channel,
    subjectTemplate: s.subjectTemplate,
    bodyTemplate: s.bodyTemplate,
    isActive: s.isActive,
  }));
}

function hasSnapshot(value) {
  return Array.isArray(value) && value.length > 0;
}

async function ensureCampaignsViewPermission() {
  console.log("\n[permissions] ensure campaigns.view");
  const tables = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'permissions' LIMIT 1`
  );
  if (!Array.isArray(tables) || tables.length === 0) {
    console.log("  skip — permissions table missing");
    return;
  }

  const permId = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO permissions (id, key, name, created_at, updated_at)
     VALUES ($1, 'campaigns.view', 'campaigns.view', NOW(), NOW())
     ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
    permId
  );

  await prisma.$executeRawUnsafe(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    CROSS JOIN permissions p
    WHERE p.key = 'campaigns.view'
      AND r.key IN (
        'viewer',
        'sales_rep',
        'sales_manager',
        'company_admin',
        'platform_admin'
      )
    ON CONFLICT DO NOTHING
  `);
  console.log("  campaigns.view linked to view/manage roles");
}

async function main() {
  const { flags, opts } = parseArgs(process.argv.slice(2));
  const dryRun = flags.has("dry-run") || !flags.has("execute");
  const organizationId = opts.organizationId || null;
  const limit = Number.isFinite(opts.limit) ? Math.max(1, opts.limit) : 500;

  console.log("Phase 5 — sequence snapshot backfill");
  console.log(`  mode: ${dryRun ? "DRY-RUN (no writes to enrollments)" : "EXECUTE"}`);
  if (organizationId) console.log(`  organizationId: ${organizationId}`);
  console.log(`  batch limit: ${limit}`);

  if (!dryRun) {
    await ensureCampaignsViewPermission();
  } else {
    console.log("\n[permissions] skipped in dry-run (pass --execute to seed campaigns.view)");
  }

  // Prefer rows missing snapshot so --limit is not wasted on already-filled rows
  const missingIds = await prisma.$queryRawUnsafe(
    organizationId
      ? `SELECT id FROM sequence_enrollments
         WHERE organization_id = $1
           AND (
             steps_snapshot IS NULL
             OR steps_snapshot = 'null'::jsonb
             OR steps_snapshot = '[]'::jsonb
           )
         ORDER BY created_at ASC
         LIMIT $2`
      : `SELECT id FROM sequence_enrollments
         WHERE (
             steps_snapshot IS NULL
             OR steps_snapshot = 'null'::jsonb
             OR steps_snapshot = '[]'::jsonb
           )
         ORDER BY created_at ASC
         LIMIT $1`,
    ...(organizationId ? [organizationId, limit] : [limit])
  );

  const ids = Array.isArray(missingIds)
    ? missingIds.map((r) => r.id).filter(Boolean)
    : [];

  const candidates =
    ids.length === 0
      ? []
      : await prisma.sequenceEnrollment.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            organizationId: true,
            sequenceId: true,
            stepsSnapshot: true,
            sequence: {
              select: {
                id: true,
                steps: {
                  orderBy: { stepOrder: "asc" },
                  select: {
                    stepOrder: true,
                    delayMinutes: true,
                    channel: true,
                    subjectTemplate: true,
                    bodyTemplate: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        });

  // Preserve created_at order from SQL
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

  const missing = ordered.filter((e) => !hasSnapshot(e.stepsSnapshot));
  const toProcess = missing;

  let wouldUpdate = 0;
  let updated = 0;
  let skippedNoSteps = 0;

  console.log(
    `\n[scan] missingSnapshotIds=${ids.length} loaded=${ordered.length} process=${toProcess.length}`
  );

  for (const enrollment of toProcess) {
    if (hasSnapshot(enrollment.stepsSnapshot)) continue;
    const snap = snapshotSteps(enrollment.sequence?.steps ?? []);
    if (!snap.length) {
      skippedNoSteps += 1;
      console.log(`  skip ${enrollment.id} — sequence has no steps`);
      continue;
    }

    wouldUpdate += 1;
    if (dryRun) {
      console.log(
        `  dry-run would set snapshot (${snap.length} steps) enrollment=${enrollment.id} org=${enrollment.organizationId}`
      );
      continue;
    }

    // Never overwrite: conditional update only when snapshot is null/empty
    const result = await prisma.$executeRawUnsafe(
      `UPDATE sequence_enrollments
       SET steps_snapshot = $1::jsonb, updated_at = NOW()
       WHERE id = $2
         AND organization_id = $3
         AND (
           steps_snapshot IS NULL
           OR steps_snapshot = 'null'::jsonb
           OR steps_snapshot = '[]'::jsonb
         )`,
      JSON.stringify(snap),
      enrollment.id,
      enrollment.organizationId
    );
    if (result === 1 || result === BigInt(1)) {
      updated += 1;
      console.log(`  updated ${enrollment.id}`);
    } else {
      console.log(`  skip ${enrollment.id} — snapshot already present (race)`);
    }
  }

  console.log("\nSummary");
  console.log(`  wouldUpdate: ${wouldUpdate}`);
  console.log(`  updated: ${updated}`);
  console.log(`  skippedNoSteps: ${skippedNoSteps}`);
  console.log(
    dryRun
      ? "  DRY-RUN complete — re-run with --execute to apply"
      : "  EXECUTE complete"
  );
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
