/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B5c apply — DataExportStatus enum + data_export_jobs table. Requires APPLY=1.
 */
const {
  createPrisma,
  isApply,
  tableExists,
  enumExists,
} = require("./b5c-lib");

async function main() {
  if (!isApply()) {
    console.error("Refusing to apply without APPLY=1");
    process.exit(1);
  }
  const prisma = createPrisma();
  const log = [];
  try {
    if (!(await enumExists(prisma, "DataExportStatus"))) {
      await prisma.$executeRawUnsafe(`
        CREATE TYPE "DataExportStatus" AS ENUM (
          'PENDING', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED'
        )
      `);
      log.push("CREATE ENUM DataExportStatus");
    } else {
      log.push("skip ENUM DataExportStatus");
    }

    if (!(await tableExists(prisma, "data_export_jobs"))) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "data_export_jobs" (
          "id" TEXT NOT NULL,
          "organization_id" TEXT NOT NULL,
          "requested_by_user_id" TEXT NOT NULL,
          "status" "DataExportStatus" NOT NULL DEFAULT 'PENDING',
          "download_token" TEXT NOT NULL,
          "file_path" TEXT,
          "file_size_bytes" INTEGER,
          "error" TEXT,
          "expires_at" TIMESTAMP(3),
          "started_at" TIMESTAMP(3),
          "completed_at" TIMESTAMP(3),
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "data_export_jobs_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX "data_export_jobs_download_token_key" ON "data_export_jobs"("download_token")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "data_export_jobs_organization_id_created_at_idx" ON "data_export_jobs"("organization_id", "created_at")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "data_export_jobs_status_expires_at_idx" ON "data_export_jobs"("status", "expires_at")`
      );
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "data_export_jobs"
        ADD CONSTRAINT "data_export_jobs_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
      log.push("CREATE TABLE data_export_jobs");
    } else {
      log.push("skip table data_export_jobs");
    }

    console.log(JSON.stringify({ slice: "B5c", mode: "apply", log }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
