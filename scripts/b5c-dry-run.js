/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B5c dry-run — DataExportJob schema + code file presence. No writes.
 */
const { createPrisma, schemaReport } = require("./b5c-lib");
const fs = require("fs");
const path = require("path");

function exists(rel) {
  return fs.existsSync(path.join(__dirname, "..", rel));
}

async function main() {
  const prisma = createPrisma();
  try {
    const schema = await schemaReport(prisma);
    const files = {
      "tenant-banner-state.ts": exists(
        "src/lib/billing/tenant-banner-state.ts"
      ),
      "tenant-status-banners.tsx": exists(
        "src/components/billing/tenant-status-banners.tsx"
      ),
      "privacy-export.service.ts": exists(
        "src/services/privacy-export.service.ts"
      ),
      "api/privacy/export/route.ts": exists(
        "src/app/api/privacy/export/route.ts"
      ),
      "data-export-card.tsx": exists(
        "src/components/settings/data-export-card.tsx"
      ),
    };
    const gaps = [];
    if (!schema.enum_DataExportStatus) gaps.push("CREATE ENUM DataExportStatus");
    if (!schema.table_data_export_jobs) gaps.push("CREATE TABLE data_export_jobs");
    for (const [f, ok] of Object.entries(files)) {
      if (!ok) gaps.push(`missing ${f}`);
    }

    console.log(
      JSON.stringify(
        {
          slice: "B5c",
          mode: "dry-run",
          schema,
          files,
          gaps,
          wouldApply: gaps.some((g) => g.startsWith("CREATE")),
          next: gaps.some((g) => g.startsWith("CREATE"))
            ? "Say GO → APPLY=1 node scripts/b5c-apply.js && npm run build && pm2 restart sales"
            : "Say GO → npm run build && pm2 restart sales",
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
