-- B1 additive schema only (safe / idempotent). Avoids full prisma db push.
-- Mirrors prisma OrganizationStatus / SubscriptionStatus / Plan / PlanVersion / Subscription.
-- Patterns match scripts/s25-schema.sql.

-- OrganizationStatus: INVITED, ARCHIVED
DO $$ BEGIN
  ALTER TYPE "OrganizationStatus" ADD VALUE IF NOT EXISTS 'INVITED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "OrganizationStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SubscriptionStatus: NONE, EXPIRED
DO $$ BEGIN
  ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'NONE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- organizations: country, internal_notes
DO $$ BEGIN
  ALTER TABLE "organizations" ADD COLUMN "country" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "organizations" ADD COLUMN "internal_notes" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- plans: most_popular, current_version_id, archived_at
DO $$ BEGIN
  ALTER TABLE "plans" ADD COLUMN "most_popular" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "plans" ADD COLUMN "current_version_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "plans" ADD COLUMN "archived_at" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "plans_archived_at_idx" ON "plans"("archived_at");
CREATE INDEX IF NOT EXISTS "plans_current_version_id_idx" ON "plans"("current_version_id");

-- plan_versions
CREATE TABLE IF NOT EXISTS "plan_versions" (
  "id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "price_monthly" DECIMAL(12, 2) NOT NULL,
  "price_yearly" DECIMAL(12, 2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "monthly_credits" INTEGER,
  "credit_rollover_enabled" BOOLEAN NOT NULL DEFAULT false,
  "credit_rollover_cap_months" INTEGER,
  "stripe_price_id_monthly" TEXT,
  "stripe_price_id_yearly" TEXT,
  "notes" TEXT,
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "plan_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "plan_versions_plan_id_version_key"
  ON "plan_versions"("plan_id", "version");
CREATE INDEX IF NOT EXISTS "plan_versions_plan_id_idx"
  ON "plan_versions"("plan_id");

DO $$ BEGIN
  ALTER TABLE "plan_versions"
    ADD CONSTRAINT "plan_versions_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "plans"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- plan_version_features
CREATE TABLE IF NOT EXISTS "plan_version_features" (
  "id" TEXT NOT NULL,
  "plan_version_id" TEXT NOT NULL,
  "feature_key" TEXT NOT NULL,
  "limit_value" INTEGER,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "plan_version_features_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "plan_version_features_plan_version_id_feature_key_key"
  ON "plan_version_features"("plan_version_id", "feature_key");
CREATE INDEX IF NOT EXISTS "plan_version_features_feature_key_idx"
  ON "plan_version_features"("feature_key");

DO $$ BEGIN
  ALTER TABLE "plan_version_features"
    ADD CONSTRAINT "plan_version_features_plan_version_id_fkey"
    FOREIGN KEY ("plan_version_id") REFERENCES "plan_versions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- subscriptions: plan_version_id, pending_*, access_mode, trial/grace/read_only
DO $$ BEGIN
  ALTER TABLE "subscriptions" ADD COLUMN "plan_version_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "subscriptions" ADD COLUMN "pending_plan_version_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "subscriptions" ADD COLUMN "pending_apply_at" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "subscriptions" ADD COLUMN "access_mode" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "subscriptions" ADD COLUMN "trial_ends_at" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "subscriptions" ADD COLUMN "grace_period_ends_at" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "subscriptions" ADD COLUMN "read_only_until" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "subscriptions_plan_version_id_idx"
  ON "subscriptions"("plan_version_id");
CREATE INDEX IF NOT EXISTS "subscriptions_trial_ends_at_idx"
  ON "subscriptions"("trial_ends_at");
CREATE INDEX IF NOT EXISTS "subscriptions_grace_period_ends_at_idx"
  ON "subscriptions"("grace_period_ends_at");
CREATE INDEX IF NOT EXISTS "subscriptions_pending_apply_at_idx"
  ON "subscriptions"("pending_apply_at");

DO $$ BEGIN
  ALTER TABLE "subscriptions"
    ADD CONSTRAINT "subscriptions_plan_version_id_fkey"
    FOREIGN KEY ("plan_version_id") REFERENCES "plan_versions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "subscriptions"
    ADD CONSTRAINT "subscriptions_pending_plan_version_id_fkey"
    FOREIGN KEY ("pending_plan_version_id") REFERENCES "plan_versions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Prefer NONE as default for new subscriptions (safe if column already defaulted)
DO $$ BEGIN
  ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DEFAULT 'NONE'::"SubscriptionStatus";
EXCEPTION WHEN others THEN NULL; END $$;
