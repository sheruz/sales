/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B4a dry-run — schema gaps, txn amount backfill preview, webhook reclass, Free sub report.
 * No writes.
 */
const {
  createPrisma,
  columnExists,
  tableExists,
  parsePaddleMoney,
  classifyWebhookRow,
} = require("./b4a-lib");

async function main() {
  const prisma = createPrisma();
  try {
    const schema = {
      "billing_transactions.tax_amount": await columnExists(
        prisma,
        "billing_transactions",
        "tax_amount"
      ),
      "users.totp_secret_enc": await columnExists(
        prisma,
        "users",
        "totp_secret_enc"
      ),
      "users.totp_enabled_at": await columnExists(
        prisma,
        "users",
        "totp_enabled_at"
      ),
    };

    // Zero-amount transactions with webhook payloads
    const zeroTxns = await prisma.$queryRawUnsafe(`
      SELECT bt.id, bt.external_id, bt.amount::text AS amount, bt.kind, bt.provider,
             bt.organization_id, o.name AS org_name
      FROM billing_transactions bt
      LEFT JOIN organizations o ON o.id = bt.organization_id
      WHERE bt.amount = 0
      ORDER BY bt.occurred_at DESC
      LIMIT 200
    `).catch(() => []);

    const txnPreview = [];
    for (const t of zeroTxns) {
      if (!t.external_id) {
        txnPreview.push({
          id: t.id,
          org: t.org_name,
          oldAmount: 0,
          newAmount: null,
          note: "no external_id",
        });
        continue;
      }
      const wh = await prisma.billingWebhookEvent.findFirst({
        where: {
          OR: [
            { payload: { path: ["data", "id"], equals: t.external_id } },
          ],
        },
        select: { payload: true, eventType: true },
      }).catch(() => null);

      // Fallback: scan recent events for matching id in JSON text
      let payload = wh?.payload;
      if (!payload) {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT payload FROM billing_webhook_events
           WHERE payload::text LIKE $1
           ORDER BY created_at DESC LIMIT 1`,
          `%${t.external_id}%`
        ).catch(() => []);
        payload = rows[0]?.payload;
      }
      const money = payload ? parsePaddleMoney(payload) : null;
      txnPreview.push({
        id: t.id,
        org: t.org_name,
        externalId: t.external_id,
        kind: t.kind,
        oldAmount: 0,
        newAmount: money?.amount ?? null,
        tax: money?.tax ?? null,
        fee: money?.fee ?? null,
        net: money?.net ?? null,
        currency: money?.currency ?? null,
      });
    }

    let attention = [];
    let webhookNote = null;
    try {
      attention = await prisma.$queryRawUnsafe(`
        SELECT id, event_id AS "eventId", event_type AS "eventType",
               status, error, payload
        FROM billing_webhook_events
        WHERE status IN ('error','unmatched')
        LIMIT 200
      `);
    } catch (e) {
      webhookNote =
        e instanceof Error ? e.message : "webhook query failed — run on server DB";
      attention = [];
    }

    const reclass = attention.map((r) => {
      const proposed = classifyWebhookRow({
        status: r.status,
        error: r.error,
        event_type: r.eventType,
        payload: r.payload,
      });
      return {
        id: r.id,
        eventId: r.eventId,
        eventType: r.eventType,
        from: r.status,
        to: proposed.to,
        reason: proposed.reason,
      };
    });
    const wouldSkip = reclass.filter(
      (r) => r.from !== r.to && r.to === "skipped"
    );

    let freeSubs = [];
    let publicInternal = [];
    let plansNote = null;
    try {
      freeSubs = await prisma.subscription.findMany({
        where: {
          planVersion: {
            plan: {
              OR: [
                { code: "FREE" },
                { name: { equals: "Free", mode: "insensitive" } },
              ],
            },
          },
        },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          planVersion: {
            select: {
              id: true,
              plan: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  archivedAt: true,
                  visibility: true,
                },
              },
            },
          },
        },
      });
      publicInternal = await prisma.plan.findMany({
        where: {
          OR: [
            { code: { in: ["OWNER", "COMPLIMENTARY"] }, visibility: "PUBLIC" },
            {
              name: { contains: "Internal Owner", mode: "insensitive" },
              visibility: "PUBLIC",
            },
          ],
        },
        select: { id: true, name: true, code: true, visibility: true },
      });
    } catch (e) {
      plansNote =
        e instanceof Error ? e.message : "plans query failed — run on server";
    }

    console.log(
      JSON.stringify(
        {
          phase: "B4a",
          mode: "dry-run",
          schema,
          zeroAmountTransactions: {
            count: zeroTxns.length,
            preview: txnPreview,
          },
          webhookAttention: {
            total: attention.length,
            wouldReclassifyToSkipped: wouldSkip.length,
            sample: reclass.slice(0, 40),
            note: webhookNote,
          },
          archivedFreeSubscribers: freeSubs.map((s) => ({
            organizationId: s.organization.id,
            organizationName: s.organization.name,
            slug: s.organization.slug,
            status: s.status,
            plan: s.planVersion?.plan,
            proposal:
              "Migrate to Starter (NONE/locked) or assign Starter trial — await approval",
          })),
          internalPlansWronglyPublic: publicInternal,
          plansNote,
          next: "Review preview on server DB. Then APPLY=1 node scripts/b4a-apply.js after GO",
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
