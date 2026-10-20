/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B4a apply — schema columns, txn amount backfill, webhook reclass, plan visibility fix,
 * mark SUPER_ADMIN for 2FA enrollment prompt. Requires APPLY=1.
 *
 * Uses raw SQL for new columns so it works before `prisma generate`.
 */
const {
  createPrisma,
  isApply,
  columnExists,
  tableExists,
  parsePaddleMoney,
  classifyWebhookRow,
} = require("./b4a-lib");

async function ensureColumn(client, table, column, ddl, log) {
  if (await columnExists(client, table, column)) {
    log.push(`skip ${table}.${column}`);
    return;
  }
  await client.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN ${ddl}`);
  log.push(`ADD ${table}.${column}`);
}

async function main() {
  if (!isApply()) {
    console.error("Refusing to apply without APPLY=1");
    process.exit(1);
  }
  const prisma = createPrisma();
  const log = [];
  try {
    if (await tableExists(prisma, "billing_transactions")) {
      await ensureColumn(
        prisma,
        "billing_transactions",
        "tax_amount",
        `"tax_amount" DECIMAL(12,2)`,
        log
      );
    }
    await ensureColumn(
      prisma,
      "users",
      "totp_secret_enc",
      `"totp_secret_enc" TEXT`,
      log
    );
    await ensureColumn(
      prisma,
      "users",
      "totp_enabled_at",
      `"totp_enabled_at" TIMESTAMP(3)`,
      log
    );
    await ensureColumn(
      prisma,
      "users",
      "totp_recovery_codes_enc",
      `"totp_recovery_codes_enc" TEXT`,
      log
    );
    await ensureColumn(
      prisma,
      "users",
      "totp_enrollment_required",
      `"totp_enrollment_required" BOOLEAN NOT NULL DEFAULT false`,
      log
    );

    // Fix internal plans PUBLIC → INTERNAL (raw — works regardless of client)
    const fixedPlans = await prisma.$executeRawUnsafe(`
      UPDATE plans
      SET visibility = 'INTERNAL', updated_at = CURRENT_TIMESTAMP
      WHERE visibility = 'PUBLIC'
        AND (
          UPPER(COALESCE(code, '')) IN ('OWNER', 'COMPLIMENTARY')
          OR name ILIKE '%Internal Owner%'
        )
    `);
    log.push(`plans visibility INTERNAL: ${fixedPlans}`);

    // Prompt SUPER_ADMIN to enroll 2FA (raw SQL — client may not know new columns yet)
    const sa = await prisma.$executeRawUnsafe(`
      UPDATE users
      SET totp_enrollment_required = true, updated_at = CURRENT_TIMESTAMP
      WHERE deleted_at IS NULL
        AND totp_enabled_at IS NULL
        AND (
          role = 'SUPER_ADMIN'
          OR platform_role = 'SUPER_ADMIN'
        )
    `);
    log.push(`super admins marked enrollment required: ${sa}`);

    // Backfill amounts via raw SQL
    const zeroTxns = await prisma.$queryRawUnsafe(`
      SELECT id, external_id AS "externalId", amount::text AS amount
      FROM billing_transactions
      WHERE amount = 0
      LIMIT 500
    `);
    let backfilled = 0;
    for (const t of zeroTxns) {
      if (!t.externalId) continue;
      let rows = [];
      try {
        rows = await prisma.$queryRawUnsafe(
          `SELECT payload FROM billing_webhook_events
           WHERE payload::text LIKE $1
           ORDER BY COALESCE(occurred_at, processed_at) DESC NULLS LAST
           LIMIT 1`,
          `%${t.externalId}%`
        );
      } catch {
        rows = await prisma.$queryRawUnsafe(
          `SELECT payload FROM billing_webhook_events
           WHERE payload::text LIKE $1
           LIMIT 1`,
          `%${t.externalId}%`
        );
      }
      const payload = rows[0]?.payload;
      if (!payload) continue;
      const money = parsePaddleMoney(payload);
      if (!money.amount || money.amount === 0) continue;
      await prisma.$executeRawUnsafe(
        `UPDATE billing_transactions
         SET amount = $1,
             currency = $2,
             tax_amount = $3,
             fee_amount = $4,
             net_amount = $5,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        money.amount,
        money.currency,
        money.tax,
        money.fee,
        money.net,
        t.id
      );
      backfilled++;
      log.push(
        `txn ${t.id} ${t.externalId}: 0 → ${money.amount} ${money.currency}`
      );
    }
    log.push(`backfilled transactions: ${backfilled}`);

    // Reclassify webhooks (raw)
    const attention = await prisma.$queryRawUnsafe(`
      SELECT id, event_id AS "eventId", event_type AS "eventType",
             status, error, payload
      FROM billing_webhook_events
      WHERE status IN ('error', 'unmatched')
      LIMIT 500
    `);
    let skipped = 0;
    for (const r of attention) {
      const proposed = classifyWebhookRow({
        status: r.status,
        error: r.error,
        event_type: r.eventType,
        payload: r.payload,
      });
      if (proposed.to === "skipped" && r.status !== "skipped") {
        await prisma.$executeRawUnsafe(
          `UPDATE billing_webhook_events
           SET status = 'skipped', error = $1
           WHERE id = $2`,
          proposed.reason || "skipped",
          r.id
        );
        skipped++;
      }
    }
    log.push(`webhooks reclassified to skipped: ${skipped}`);

    const remainingRows = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS n FROM billing_webhook_events
      WHERE status IN ('error', 'unmatched')
    `);
    const remaining = remainingRows[0]?.n ?? -1;

    console.log(
      JSON.stringify(
        {
          phase: "B4a",
          mode: "apply",
          log,
          webhookAttentionRemaining: remaining,
          note: "Free plan migration NOT applied — none found in dry-run. Then: npx prisma generate && npm run build && pm2 restart sales",
          next: "npx prisma generate && npm run build && pm2 restart sales",
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
