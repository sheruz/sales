import { z } from "zod";

function resolveDatabaseUrl(): void {
  if (process.env.DATABASE_URL) return;

  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const db = process.env.POSTGRES_DB;

  if (!user || !password || !db) return;

  const host = process.env.POSTGRES_HOST ?? "localhost";
  const port = process.env.POSTGRES_PORT ?? "5432";

  process.env.DATABASE_URL = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${db}?schema=public`;
}

function sanitizeEnv(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const sanitized: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;
    const trimmed = value.trim();
    sanitized[key] = trimmed === "" ? undefined : trimmed;
  }

  return sanitized;
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  SESSION_EXPIRY_HOURS: z.coerce.number().default(24),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  AI_PROVIDER: z.enum(["openai", "anthropic"]).default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-3-5-sonnet-20241022"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_NAME: z.string().default("Sales Platform"),
  SMTP_FROM_EMAIL: z.union([z.string().email(), z.undefined()]).optional(),
  REDIS_URL: z.string().optional(),
  USE_REDIS_QUEUE: z.coerce.boolean().default(false),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  ENCRYPTION_KEY: z.string().optional(),
  JOB_POLL_INTERVAL_MS: z.coerce.number().default(60000),
  FOLLOWUP_CHECK_INTERVAL_MS: z.coerce.number().default(300000),
  LINKEDIN_LI_AT: z.string().optional(),
  LINKEDIN_JSESSIONID: z.string().optional(),
  AUTOPILOT_ENABLED: z.coerce.boolean().default(false),
  CRON_SECRET: z.string().optional(),
});

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function getEnv(): z.infer<typeof envSchema> {
  if (cachedEnv) return cachedEnv;

  resolveDatabaseUrl();

  const parsed = envSchema.safeParse(sanitizeEnv(process.env));

  if (!parsed.success) {
    console.error(
      "Invalid environment variables:",
      parsed.error.flatten().fieldErrors
    );
    throw new Error("Invalid environment variables");
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export const env = new Proxy({} as z.infer<typeof envSchema>, {
  get(_target, prop: string) {
    return getEnv()[prop as keyof z.infer<typeof envSchema>];
  },
});

export type Env = z.infer<typeof envSchema>;
