/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B4a apply — schema columns, txn amount backfill, webhook reclass, plan visibility fix,
 * mark SUPER_ADMIN for 2FA enrollment prompt. Requires APPLY=1.
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

    // Fix internal plans PUBLIC → INTERNAL
    const fixedPlans = await prisma.plan.updateMany({
      where: {
        OR: [
          { code: { in: ["OWNER", "COMPLIMENTARY"] } },
          { name: { contains: "Internal Owner", mode: "insensitive" } },
        ],
        visibility: "PUBLIC",
      },
      data: { visibility: "INTERNAL" },
    });
    log.push(`plans visibility INTERNAL: ${fixedPlans.count}`);

    // Prompt SUPER_ADMIN to enroll 2FA (do not force before enroll)
    const sa = await prisma.user.updateMany({
      where: {
        OR: [{ role: "SUPER_ADMIN" }, { platformRole: "SUPER_ADMIN" }],
        totpEnabledAt: null,
      },
      data: { totpEnrollmentRequired: true },
    });
    log.push(`super admins marked enrollment required: ${sa.count}`);

    // Backfill amounts
    const zeroTxns = await prisma.billingTransaction.findMany({
      where: { amount: 0 },
      take: 500,
    });
    let backfilled = 0;
    for (const t of zeroTxns) {
      if (!t.externalId) continue;
      const rows = await prisma.$queryRawUnsafe(
        `SELECT payload FROM billing_webhook_events
         WHERE payload::text LIKE $1
         ORDER BY created_at DESC LIMIT 1`,
        `%${t.externalId}%`
      );
      const payload = rows[0]?.payload;
      if (!payload) continue;
      const money = parsePaddleMoney(payload);
      if (!money.amount || money.amount === 0) continue;
      await prisma.billingTransaction.update({
        where: { id: t.id },
        data: {
          amount: money.amount,
          currency: money.currency,
          taxAmount: money.tax,
          feeAmount: money.fee,
          netAmount: money.net,
        },
      });
      backfilled++;
      log.push(
        `txn ${t.id} ${t.externalId}: 0 → ${money.amount} ${money.currency}`
      );
    }
    log.push(`backfilled transactions: ${backfilled}`);

    // Reclassify webhooks
    const attention = await prisma.billingWebhookEvent.findMany({
      where: { status: { in: ["error", "unmatched"] } },
      take: 500,
    });
    let skipped = 0;
    for (const r of attention) {
      const proposed = classifyWebhookRow({
        status: r.status,
        error: r.error,
        event_type: r.eventType,
        payload: r.payload,
      });
      if (proposed.to === "skipped" && r.status !== "skipped") {
        await prisma.billingWebhookEvent.update({
          where: { id: r.id },
          data: { status: "skipped", error: proposed.reason },
        });
        skipped++;
      }
    }
    log.push(`webhooks reclassified to skipped: ${skipped}`);

    const remaining = await prisma.billingWebhookEvent.count({
      where: { status: { in: ["error", "unmatched"] } },
    });

    console.log(
      JSON.stringify(
        {
          phase: "B4a",
          mode: "apply",
          log,
          webhookAttentionRemaining: remaining,
          note: "Free plan migration NOT applied — see dry-run report; await approval",
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
