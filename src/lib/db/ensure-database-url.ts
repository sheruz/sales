/**
 * Ensures process.env.DATABASE_URL is set before PrismaClient initializes.
 * Supports either DATABASE_URL directly or POSTGRES_* component vars.
 */
export function ensureDatabaseUrl(): string {
  if (process.env.DATABASE_URL?.trim()) {
    return process.env.DATABASE_URL.trim();
  }

  const user = process.env.POSTGRES_USER ?? "postgres";
  const password = process.env.POSTGRES_PASSWORD ?? "";
  const host = process.env.POSTGRES_HOST ?? "localhost";
  const port = process.env.POSTGRES_PORT ?? "5432";
  const db = process.env.POSTGRES_DB ?? "sales_platform";

  const url = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${db}?schema=public`;
  process.env.DATABASE_URL = url;
  return url;
}
