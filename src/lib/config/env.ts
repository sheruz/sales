import { z } from "zod";

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
  SMTP_FROM_EMAIL: z.string().email().optional(),
  REDIS_URL: z.string().optional(),
  USE_REDIS_QUEUE: z.coerce.boolean().default(false),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  JOB_POLL_INTERVAL_MS: z.coerce.number().default(60000),
  FOLLOWUP_CHECK_INTERVAL_MS: z.coerce.number().default(300000),
});

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function getEnv(): z.infer<typeof envSchema> {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);

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
