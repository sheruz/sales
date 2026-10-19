-- B2 additive schema only (safe / idempotent).
-- Pause flags, draft PlanVersion, TopUpPack, PlanLimitNotice, override expiresAt.

-- PlanVersionStatus
DO $$ BEGIN
  CREATE TYPE "PlanVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PlanLimitNoticeStatus
DO $$ BEGIN
  CREATE TYPE "PlanLimitNoticeStatus" AS ENUM ('PENDING', 'RESOLVED', 'APPLIED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- plan_versions: draft/publish + optimistic lock
DO $$ BEGIN
  ALTER TABLE "plan_versions" ADD COLUMN "status" "PlanVersionStatus" NOT NULL DEFAULT 'PUBLISHED';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "plan_versions" ADD COLUMN "editor_revision" INTEGER NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "plan_versions" ADD COLUMN "published_at" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "plan_versions" ADD COLUMN "published_by_user_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "plan_versions" ADD COLUMN "apply_mode" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "plan_versions" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "plan_versions_status_idx" ON "plan_versions"("status");

-- org_entitlement_overrides.expires_at
DO $$ BEGIN
  ALTER TABLE "org_entitlement_overrides" ADD COLUMN "expires_at" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "org_entitlement_overrides_expires_at_idx"
  ON "org_entitlement_overrides"("expires_at");

-- Pause columns helper pattern on seat resources
DO $$ BEGIN ALTER TABLE "organization_users" ADD COLUMN "paused_at" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "organization_users" ADD COLUMN "pause_reason" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "organization_users" ADD COLUMN "pause_notice_at" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "organization_users_paused_at_idx" ON "organization_users"("paused_at");

DO $$ BEGIN ALTER TABLE "outbound_mailboxes" ADD COLUMN "paused_at" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "outbound_mailboxes" ADD COLUMN "pause_reason" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "outbound_mailboxes" ADD COLUMN "pause_notice_at" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "outbound_mailboxes_paused_at_idx" ON "outbound_mailboxes"("paused_at");

DO $$ BEGIN ALTER TABLE "campaigns" ADD COLUMN "paused_at" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "campaigns" ADD COLUMN "pause_reason" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "campaigns" ADD COLUMN "pause_notice_at" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "campaigns_paused_at_idx" ON "campaigns"("paused_at");

DO $$ BEGIN ALTER TABLE "outreach_sequences" ADD COLUMN "paused_at" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "outreach_sequences" ADD COLUMN "pause_reason" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "outreach_sequences" ADD COLUMN "pause_notice_at" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "outreach_sequences_paused_at_idx" ON "outreach_sequences"("paused_at");

DO $$ BEGIN ALTER TABLE "icps" ADD COLUMN "paused_at" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "icps" ADD COLUMN "pause_reason" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "icps" ADD COLUMN "pause_notice_at" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "icps_paused_at_idx" ON "icps"("paused_at");

DO $$ BEGIN ALTER TABLE "source_connectors" ADD COLUMN "paused_at" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "source_connectors" ADD COLUMN "pause_reason" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "source_connectors" ADD COLUMN "pause_notice_at" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "source_connectors_paused_at_idx" ON "source_connectors"("paused_at");

-- top_up_packs
CREATE TABLE IF NOT EXISTS "top_up_packs" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "credits" INTEGER NOT NULL,
  "price" DECIMAL(12, 2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "top_up_packs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "top_up_packs_active_idx" ON "top_up_packs"("active");
CREATE INDEX IF NOT EXISTS "top_up_packs_archived_at_idx" ON "top_up_packs"("archived_at");

-- plan_limit_notices
CREATE TABLE IF NOT EXISTS "plan_limit_notices" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "feature_key" TEXT NOT NULL,
  "allowed_count" INTEGER NOT NULL,
  "plan_version_id" TEXT,
  "status" "PlanLimitNoticeStatus" NOT NULL DEFAULT 'PENDING',
  "notice_at" TIMESTAMP(3) NOT NULL,
  "deadline_at" TIMESTAMP(3) NOT NULL,
  "selected_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "resolved_at" TIMESTAMP(3),
  "applied_at" TIMESTAMP(3),
  "email_stub_sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "plan_limit_notices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "plan_limit_notices_organization_id_status_idx"
  ON "plan_limit_notices"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "plan_limit_notices_deadline_at_idx"
  ON "plan_limit_notices"("deadline_at");
CREATE INDEX IF NOT EXISTS "plan_limit_notices_feature_key_idx"
  ON "plan_limit_notices"("feature_key");

DO $$ BEGIN
  ALTER TABLE "plan_limit_notices"
    ADD CONSTRAINT "plan_limit_notices_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "plan_limit_notices"
    ADD CONSTRAINT "plan_limit_notices_plan_version_id_fkey"
    FOREIGN KEY ("plan_version_id") REFERENCES "plan_versions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
