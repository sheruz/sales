/* eslint-disable @typescript-eslint/no-require-imports */
require("./load-env");
const { ensureDatabaseUrl } = require("./database-url");
ensureDatabaseUrl();

const {
  createPrisma,
  tableExists,
  columnExists,
  enumExists,
  isApply,
} = require("./s2-lib");

async function schemaReport(prisma) {
  return {
    enum_DataExportStatus: await enumExists(prisma, "DataExportStatus"),
    table_data_export_jobs: await tableExists(prisma, "data_export_jobs"),
  };
}

module.exports = {
  createPrisma,
  tableExists,
  columnExists,
  enumExists,
  isApply,
  schemaReport,
};
