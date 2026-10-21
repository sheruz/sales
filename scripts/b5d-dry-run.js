/* eslint-disable @typescript-eslint/no-require-imports */
const { createPrisma, schemaReport } = require("./b5d-lib");
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
      "onboarding/page.tsx": exists("src/app/dashboard/onboarding/page.tsx"),
      "onboarding-wizard-client.tsx": exists(
        "src/components/onboarding/onboarding-wizard-client.tsx"
      ),
      "sidebar-setup-checklist.tsx": exists(
        "src/components/dashboard/sidebar-setup-checklist.tsx"
      ),
      "api/onboarding/route.ts": exists("src/app/api/onboarding/route.ts"),
      "icp-templates.ts": exists("src/lib/onboarding/icp-templates.ts"),
    };
    const gaps = [];
    if (!schema.table_onboarding_progress) {
      gaps.push("CREATE TABLE onboarding_progress");
    }
    for (const [f, ok] of Object.entries(files)) {
      if (!ok) gaps.push(`missing ${f}`);
    }
    console.log(
      JSON.stringify(
        {
          slice: "B5d",
          mode: "dry-run",
          schema,
          files,
          gaps,
          wouldApply: gaps.some((g) => g.startsWith("CREATE")),
          next: gaps.some((g) => g.startsWith("CREATE"))
            ? "Say GO → APPLY=1 node scripts/b5d-apply.js && npm run build && pm2 restart sales"
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
