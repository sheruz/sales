/* eslint-disable @typescript-eslint/no-require-imports */
const { createPrisma, isApply, tableExists } = require("./b5d-lib");

async function main() {
  if (!isApply()) {
    console.error("Refusing to apply without APPLY=1");
    process.exit(1);
  }
  const prisma = createPrisma();
  const log = [];
  try {
    if (!(await tableExists(prisma, "onboarding_progress"))) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "onboarding_progress" (
          "organization_id" TEXT NOT NULL,
          "current_step" TEXT NOT NULL DEFAULT 'business_profile',
          "completed_steps" JSONB NOT NULL DEFAULT '[]',
          "skipped" BOOLEAN NOT NULL DEFAULT false,
          "completed_at" TIMESTAMP(3),
          "payload" JSONB NOT NULL DEFAULT '{}',
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("organization_id")
        )
      `);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "onboarding_progress"
        ADD CONSTRAINT "onboarding_progress_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
      log.push("CREATE TABLE onboarding_progress");
    } else {
      log.push("skip table onboarding_progress");
    }
    console.log(JSON.stringify({ slice: "B5d", mode: "apply", log }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
