/* eslint-disable @typescript-eslint/no-require-imports */
require("./load-env");
const { ensureDatabaseUrl } = require("./database-url");
ensureDatabaseUrl();

const {
  createPrisma,
  tableExists,
  isApply,
} = require("./s2-lib");

async function schemaReport(prisma) {
  return {
    table_onboarding_progress: await tableExists(prisma, "onboarding_progress"),
  };
}

module.exports = { createPrisma, tableExists, isApply, schemaReport };
