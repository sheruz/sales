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

/**
 * z.coerce.boolean() treats non-empty strings as true, so "false" → true.
 * Use this for all env flags that are set as true/false in .env files.
 */
const envBoolean = (defaultValue: boolean) =>
  z.preprocess((v) => {
    if (v === undefined || v === null || v === "") return defaultValue;
    if (typeof v === "boolean") return v;
    const t = String(v).trim().toLowerCase();
    if (t === "true" || t === "1" || t === "yes") return true;
    if (t === "false" || t === "0" || t === "no") return false;
    return defaultValue;
  }, z.boolean());

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
  SMTP_SECURE: envBoolean(false),
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
  /** B3: master switch — false keeps Choose Plan as mailto */
  PAYMENTS_ENABLED: envBoolean(false),
  /** B3: sandbox | production — selects Paddle API base + ProviderPriceMap env */
  PADDLE_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  PADDLE_API_KEY: z.string().optional(),
  PADDLE_CLIENT_TOKEN: z.string().optional(),
  PADDLE_WEBHOOK_SECRET: z.string().optional(),
  REDIS_URL: z.string().optional(),
  USE_REDIS_QUEUE: envBoolean(false),
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
  LINKEDIN_SESSION_ENABLED: envBoolean(false),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_REDIRECT_URI: z.string().url().optional(),
  /**
   * Default Workspace (Delvix) org id — only this org may use platform .env
   * provider keys (Places, Hunter, AI, etc.) as fallback. Never "any OWNER plan org".
   */
  PLATFORM_OWNER_ORG_ID: z.string().uuid().optional(),
  /** Record usage + shadow would-blocks. Default on for S1. */
  BILLING_METERING_ENABLED: envBoolean(true),
  /**
   * S2.5 emergency kill switch. Production MUST set explicitly to "true".
   * If unset: treated as false + startup warning (see enforcement-flags.ts).
   * Per-org Organization.billingEnforcementEnabled also required for blocking.
   */
  BILLING_ENFORCEMENT_ENABLED: envBoolean(false),
  /**
   * B1: when true, NONE/EXPIRED lock + module/SUSPENDED/CANCELED access rules apply.
   * Default false so prod can deploy code then flip after Test Tenant verify.
   * Independent of BILLING_ENFORCEMENT_ENABLED (credits/limits kill switch).
   */
  TENANT_LIFECYCLE_ENFORCED: envBoolean(false),
  /** B1: self-serve signup. Default false (Super Admin creates companies). */
  SELF_SIGNUP_ENABLED: envBoolean(false),
  /** Contact mailto on Choose Plan CTA until Stripe (B3). */
  BILLING_CONTACT_EMAIL: z.union([z.string().email(), z.undefined()]).optional(),
  /** Minutes before an open RESERVE is auto-refunded. */
  CREDIT_RESERVE_TTL_MINUTES: z.coerce.number().default(15),
  /** B1: default grace days after PAST_DUE before SUSPENDED */
  BILLING_GRACE_DAYS: z.coerce.number().default(7),
  /** B1: default trial days when Super Admin picks trial */
  BILLING_DEFAULT_TRIAL_DAYS: z.coerce.number().default(14),
  AUTOPILOT_ENABLED: envBoolean(false),
  CRON_SECRET: z.string().optional(),
  /** Comma-separated: email, linkedin. Default email-only to protect LinkedIn account */
  OUTREACH_CHANNELS: z.string().default("email"),
  /** job_posts (default) or linkedin */
  AUTOPILOT_DISCOVERY_MODE: z.enum(["job_posts", "linkedin"]).default("job_posts"),
  /** Phase 0 Client Autopilot — feature flag env defaults (org settings can override) */
  LEGACY_ENABLED: envBoolean(false),
  SOURCES_ENABLED: envBoolean(false),
  META_CONNECTOR_ENABLED: envBoolean(false),
  LINKEDIN_DISCOVERY_UI_ENABLED: envBoolean(false),
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
