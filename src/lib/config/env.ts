import { z } from "zod";
import { ensureDatabaseUrl } from "@/lib/db/ensure-database-url";

function resolveDatabaseUrl(): void {
  ensureDatabaseUrl();
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
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_QUALITY_MODEL: z.string().default("gpt-4o"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  ANTHROPIC_QUALITY_MODEL: z.string().default("claude-sonnet-4-6"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_NAME: z.string().default("Delvix"),
  SMTP_FROM_EMAIL: z.union([z.string().email(), z.undefined()]).optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().default("common"),
  MICROSOFT_REDIRECT_URI: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_SUCCESS_URL: z.string().url().optional(),
  STRIPE_CANCEL_URL: z.string().url().optional(),
  REDIS_URL: z.string().optional(),
  USE_REDIS_QUEUE: z.coerce.boolean().default(false),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  ENCRYPTION_KEY: z.string().optional(),
  JOB_POLL_INTERVAL_MS: z.coerce.number().default(60000),
  FOLLOWUP_CHECK_INTERVAL_MS: z.coerce.number().default(300000),
  LINKEDIN_LI_AT: z.string().optional(),
  LINKEDIN_JSESSIONID: z.string().optional(),
  /**
   * Cookie/Voyager SESSION mode (li_at + JSESSIONID). Default OFF for S1:
   * hide session UI, refuse new SESSION connects, no env cron fallback.
   * Existing LinkedInAccount SESSION rows are left in DB but unused.
   * Official OAuth is unaffected.
   */
  LINKEDIN_SESSION_ENABLED: z.coerce.boolean().default(false),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_REDIRECT_URI: z.string().url().optional(),
  /**
   * Default Workspace (Delvix) org id — only this org may use platform .env
   * provider keys (Places, Hunter, AI, etc.) as fallback. Never "any OWNER plan org".
   */
  PLATFORM_OWNER_ORG_ID: z.string().uuid().optional(),
  /** Record usage + shadow would-blocks. Default on for S1. */
  BILLING_METERING_ENABLED: z.coerce.boolean().default(true),
  /**
   * S2.5 emergency kill switch. Production MUST set explicitly to "true".
   * If unset: treated as false + startup warning (see enforcement-flags.ts).
   * Per-org Organization.billingEnforcementEnabled also required for blocking.
   */
  BILLING_ENFORCEMENT_ENABLED: z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined || v.trim() === "") return false;
      const t = v.trim().toLowerCase();
      return t === "true" || t === "1" || t === "yes";
    }),
  /** Minutes before an open RESERVE is auto-refunded. */
  CREDIT_RESERVE_TTL_MINUTES: z.coerce.number().default(15),
  AUTOPILOT_ENABLED: z.coerce.boolean().default(false),
  CRON_SECRET: z.string().optional(),
  /** Comma-separated: email, linkedin. Default email-only to protect LinkedIn account */
  OUTREACH_CHANNELS: z.string().default("email"),
  /** job_posts (default) or linkedin */
  AUTOPILOT_DISCOVERY_MODE: z.enum(["job_posts", "linkedin"]).default("job_posts"),
  /** Phase 0 Client Autopilot — feature flag env defaults (org settings can override) */
  LEGACY_ENABLED: z.coerce.boolean().default(false),
  SOURCES_ENABLED: z.coerce.boolean().default(false),
  META_CONNECTOR_ENABLED: z.coerce.boolean().default(false),
  LINKEDIN_DISCOVERY_UI_ENABLED: z.coerce.boolean().default(false),
  /** Optional org-wide fallback for Autopilot Google Places sourcing */
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  /** Optional org-wide fallback for Hunter.io enrichment */
  HUNTER_API_KEY: z.string().optional(),
  /** Shared secret for delvixstudio.com → POST /api/inbound/website */
  REVENUE_OS_SECRET: z.string().optional(),
  /** Organization that receives website / Autopilot waitlist inbound leads */
  WEBSITE_INBOUND_ORG_ID: z.string().uuid().optional(),
  /** Email for inbound lead notifications (falls back to org owners) */
  NOTIFY_EMAIL: z.union([z.string().email(), z.undefined()]).optional(),
  /** GA4 Measurement Protocol — email open/click mirroring (optional) */
  GA4_MEASUREMENT_ID: z.string().optional(),
  GA4_API_SECRET: z.string().optional(),
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
