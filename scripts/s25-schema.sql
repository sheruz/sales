-- S2.5 additive schema only (safe / idempotent). Avoids full prisma db push.

-- UsageMetric enum values
DO $$ BEGIN
  ALTER TYPE "UsageMetric" ADD VALUE IF NOT EXISTS 'EMAILS_DAILY';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "UsageMetric" ADD VALUE IF NOT EXISTS 'AUDITS';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "UsageMetric" ADD VALUE IF NOT EXISTS 'CRAWLS';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "UsageMetric" ADD VALUE IF NOT EXISTS 'MEETINGS';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "UsageMetric" ADD VALUE IF NOT EXISTS 'ICPS';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "UsageMetric" ADD VALUE IF NOT EXISTS 'CAMPAIGNS';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BillingAuthStatus enum
DO $$ BEGIN
  CREATE TYPE "BillingAuthStatus" AS ENUM ('AUTHORIZED', 'COMMITTED', 'REFUNDED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- billing_authorizations
CREATE TABLE IF NOT EXISTS "billing_authorizations" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "action_type" TEXT NOT NULL,
  "feature_key" TEXT NOT NULL,
  "metric" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "credits" INTEGER NOT NULL DEFAULT 0,
  "status" "BillingAuthStatus" NOT NULL DEFAULT 'AUTHORIZED',
  "reservation_idempotency_key" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "reference_type" TEXT,
  "reference_id" TEXT,
  "period_start" DATE NOT NULL,
  "day_start" DATE,
  "actor_user_id" TEXT,
  "purpose" TEXT,
  "expires_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_authorizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_authorizations_reservation_idempotency_key_key"
  ON "billing_authorizations"("reservation_idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_authorizations_idempotency_key_key"
  ON "billing_authorizations"("idempotency_key");
CREATE INDEX IF NOT EXISTS "billing_authorizations_organization_id_status_feature_key_idx"
  ON "billing_authorizations"("organization_id", "status", "feature_key");
CREATE INDEX IF NOT EXISTS "billing_authorizations_organization_id_status_day_start_idx"
  ON "billing_authorizations"("organization_id", "status", "day_start");
CREATE INDEX IF NOT EXISTS "billing_authorizations_expires_at_idx"
  ON "billing_authorizations"("expires_at");

DO $$ BEGIN
  ALTER TABLE "billing_authorizations"
    ADD CONSTRAINT "billing_authorizations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- org_entitlement_overrides
CREATE TABLE IF NOT EXISTS "org_entitlement_overrides" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "limit_value" INTEGER,
  "enabled" BOOLEAN,
  "reason" TEXT,
  "set_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "org_entitlement_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "org_entitlement_overrides_organization_id_key_key"
  ON "org_entitlement_overrides"("organization_id", "key");
CREATE INDEX IF NOT EXISTS "org_entitlement_overrides_organization_id_idx"
  ON "org_entitlement_overrides"("organization_id");

DO $$ BEGIN
  ALTER TABLE "org_entitlement_overrides"
    ADD CONSTRAINT "org_entitlement_overrides_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- New orgs default enforced (existing rows unchanged by this)
ALTER TABLE "organizations"
  ALTER COLUMN "billing_enforcement_enabled" SET DEFAULT true;
