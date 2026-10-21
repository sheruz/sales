/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B5a dry-run — schema gaps for EmailTemplate / EmailSendLog / platform email
 * transport columns + template seed coverage. No writes.
 */
const {
  createPrisma,
  schemaReport,
  TEMPLATE_KEYS,
  tableExists,
} = require("./b5a-lib");

async function main() {
  const prisma = createPrisma();
  try {
    const schema = await schemaReport(prisma);

    let existingKeys = [];
    if (schema.table_email_templates) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT key FROM email_templates ORDER BY key`
      );
      existingKeys = rows.map((r) => r.key);
    }
    const missingKeys = TEMPLATE_KEYS.filter((k) => !existingKeys.includes(k));

    let sendLogSample = { total: 0, byStatus: {} };
    if (schema.table_email_send_logs) {
      const counts = await prisma.$queryRawUnsafe(`
        SELECT status::text AS status, COUNT(*)::int AS n
        FROM email_send_logs GROUP BY status
      `);
      for (const c of counts) {
        sendLogSample.byStatus[c.status] = c.n;
        sendLogSample.total += c.n;
      }
    }

    let transport = null;
    if (schema.payment_settings_columns.platform_email_provider) {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT platform_email_provider AS provider,
               platform_email_from_email AS "fromEmail",
               platform_email_domain AS domain,
               (platform_email_resend_key_enc IS NOT NULL) AS "resendConfigured"
        FROM payment_settings WHERE id = 'default' LIMIT 1
      `);
      transport = rows[0] || null;
    }

    const gaps = [];
    if (!schema.enum_EmailSendStatus) gaps.push("CREATE ENUM EmailSendStatus");
    if (!schema.table_email_templates) gaps.push("CREATE TABLE email_templates");
    if (!schema.table_email_send_logs) gaps.push("CREATE TABLE email_send_logs");
    for (const [col, ok] of Object.entries(schema.payment_settings_columns)) {
      if (!ok) gaps.push(`ADD payment_settings.${col}`);
    }
    if (missingKeys.length) {
      gaps.push(`SEED ${missingKeys.length} email templates`);
    }

    const report = {
      slice: "B5a",
      mode: "dry-run",
      schema,
      templates: {
        expected: TEMPLATE_KEYS.length,
        existing: existingKeys.length,
        missingKeys,
      },
      sendLogSample,
      transport,
      gaps,
      wouldApply: gaps.length > 0,
      next: gaps.length
        ? "Say GO to run: APPLY=1 node scripts/b5a-apply.js && npx prisma generate && npm run build && pm2 restart sales"
        : "Schema + seeds already present — code deploy only (build + pm2 restart sales)",
    };

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
