/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B5b dry-run — no schema changes. Reports template seed coverage + UI/API readiness.
 */
const { createPrisma, schemaReport, TEMPLATE_KEYS } = require("./b5a-lib");
const fs = require("fs");
const path = require("path");

function exists(rel) {
  return fs.existsSync(path.join(__dirname, "..", rel));
}

async function main() {
  const prisma = createPrisma();
  try {
    const schema = await schemaReport(prisma);
    let templateCount = 0;
    let keys = [];
    if (schema.table_email_templates) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT key FROM email_templates ORDER BY key`
      );
      keys = rows.map((r) => r.key);
      templateCount = keys.length;
    }
    const missingKeys = TEMPLATE_KEYS.filter((k) => !keys.includes(k));

    const files = {
      "src/app/platform/emails/page.tsx": exists(
        "src/app/platform/emails/page.tsx"
      ),
      "src/components/platform/email-templates-client.tsx": exists(
        "src/components/platform/email-templates-client.tsx"
      ),
      "src/app/api/platform/email-templates/route.ts": exists(
        "src/app/api/platform/email-templates/route.ts"
      ),
      "src/app/api/platform/email-sends/route.ts": exists(
        "src/app/api/platform/email-sends/route.ts"
      ),
    };

    const gaps = [];
    if (!schema.table_email_templates) {
      gaps.push("B5a schema missing — run APPLY=1 node scripts/b5a-apply.js first");
    }
    if (missingKeys.length) gaps.push(`SEED missing templates: ${missingKeys.join(", ")}`);
    for (const [f, ok] of Object.entries(files)) {
      if (!ok) gaps.push(`missing file ${f}`);
    }

    console.log(
      JSON.stringify(
        {
          slice: "B5b",
          mode: "dry-run",
          schemaOk: Boolean(schema.table_email_templates && schema.table_email_send_logs),
          templates: { expected: TEMPLATE_KEYS.length, existing: templateCount, missingKeys },
          files,
          gaps,
          wouldApply: false,
          note: "B5b is code-only (no DB apply). Say GO → npm run build && pm2 restart sales",
          next:
            gaps.length && !schema.table_email_templates
              ? "Fix B5a schema first, then GO B5b for build+restart"
              : "Say GO to build + pm2 restart sales",
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
