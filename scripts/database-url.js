/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Builds DATABASE_URL from POSTGRES_* env vars when DATABASE_URL is not set.
 */
function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const user = process.env.POSTGRES_USER ?? "postgres";
  const password = process.env.POSTGRES_PASSWORD ?? "";
  const host = process.env.POSTGRES_HOST ?? "localhost";
  const port = process.env.POSTGRES_PORT ?? "5432";
  const db = process.env.POSTGRES_DB ?? "sales_platform";

  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${db}?schema=public`;
}

function ensureDatabaseUrl() {
  const url = buildDatabaseUrl();
  process.env.DATABASE_URL = url;
  return url;
}

module.exports = { buildDatabaseUrl, ensureDatabaseUrl };
