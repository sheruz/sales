# Delvix Revenue OS: SaaS Platform Plan (Packages, Credits, Super Admin, Billing)

## Goal
Turn Delvix Revenue OS from a single-business tool into a B2B SaaS:
- Businesses (tenants) sign up and subscribe to a **package**.
- Each tenant uses **its own integration keys** (Google Places, Hunter, Claude, Gmail/Outlook/SMTP, Zoom, Meta).
- Each package gives **limits + monthly credits**. Autopilot actions (sourcing, enrichment, audits, AI replies, etc.) consume credits.
- The **Super Admin** (platform owner) sees and controls every tenant: plan, usage, credits, invoices, payments, health.

Work in phases **S1 → S5**, one at a time, then return to Phase 6 (meetings).

---

## Non-negotiable rules (protect what already works)
1. **No breaking changes.** All schema changes are additive. Never drop or rename existing tables or columns. Back up the DB before each migrate.
2. **Existing org stays unlimited.** The current workspace (Default Workspace, Delvix) is assigned an internal `OWNER` plan with unlimited limits and credits, so nothing stops working.
3. **Enforcement is behind flags.** `BILLING_METERING_ENABLED` (record usage) and `BILLING_ENFORCEMENT_ENABLED` (block when over limit/credits) are separate flags. Ship with metering ON in **shadow mode** first (record only, never block), then turn enforcement on after verifying the numbers.
4. **Never lose inbound data.** Running out of credits or a suspended subscription may pause outbound actions, but **inbox sync, bounce handling, unsubscribe handling, and suppression always keep working**. Replies are never dropped. They are held for the human.
5. **Tenant isolation everywhere.** Every query is scoped by `organizationId`. Super admin access goes through a separate, audited path.
6. **Secrets are never shown.** Super admin sees *whether* an integration is connected and healthy, never the key itself.
7. All existing Phase 1–5 behavior (sourcing, enrichment, audits, outbound, AI replies, kill switches, shadow modes) keeps working unchanged for orgs on the OWNER plan.

---

## Core concepts

### Roles
- **Platform roles** (new, separate from org roles): `SUPER_ADMIN`, `PLATFORM_SUPPORT` (read-only). Stored on the user, not on an org membership.
- **Org roles** (existing): owner/admin/member stay as they are.
- Super admin can open a tenant in **support view** (read-only by default). Any write action on a tenant (change plan, grant credits, suspend) is recorded in an audit log with reason.

### Plans (packages)
`Plan` table, editable by super admin:
- name, code, description, visibility (public/private/internal), price monthly + yearly, currency, trial days
- **limits** (JSON or columns): seats, inbox accounts, outbound mailboxes, ICPs, active campaigns, emails sent per day, companies sourced per month, enrichments per month, audits per month, AI replies per month
- **features** (flags): AI replies, auto-send, Meta lead ads, LinkedIn assist, meetings/Zoom, white-label branding, API access
- **monthly credits included**, whether unused credits roll over (and cap)
- `OWNER` internal plan: unlimited everything (null = unlimited)

### Subscriptions
`Subscription` per org: plan, status (`TRIALING`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`, `CANCELED`), billing cycle, current period start/end, trial end, cancel at period end, payment provider + external IDs, notes.

Status effects:
- `TRIALING` / `ACTIVE`: everything allowed within plan.
- `PAST_DUE`: grace period (setting, default 7 days) with banner; after grace → behaves like SUSPENDED.
- `SUSPENDED` / `CANCELED`: outbound autopilot paused (sourcing, enrichment, audits, sending, AI auto-send). Inbox sync, unsub, bounces, viewing data, and exporting data still work.

### Credits
Append-only **credit ledger** (`CreditLedgerEntry`): org, type (`GRANT_PLAN`, `GRANT_MANUAL`, `PURCHASE`, `CONSUME`, `REFUND`, `EXPIRE`, `ADJUST`), amount (+/-), balance after, action type, reference id (e.g. audit id, message id), **idempotency key (unique)**, actor, reason, createdAt.
- Balance cached on the org but always reconcilable from the ledger.
- **Reserve → commit/refund** for actions that can fail (e.g. reserve before calling Hunter, commit on success, refund on failure).
- **Credit price table** (`CreditPrice`, editable by super admin): cost per action type. Starting examples (tune later):
  - Google sourcing (per results page): 1
  - Website crawl: 0 (included)
  - Enrichment (per company, find + verify): 2
  - Website audit + pitch: 2
  - AI reply classification: 0 (keep inbound processing free)
  - AI reply draft: 1
  - Email sent: 0 (controlled by daily send limits instead)
  - Meeting booked: 0
- **BYOK vs managed keys**: each integration can be `BYOK` (tenant's own key, tenant pays the provider) or `MANAGED` (platform key, if offered). Credit prices can differ per mode (e.g. BYOK enrichment = 0.5 platform credit, managed = 2). Default for now: **BYOK only**, credits measure platform usage.
- Low credit warnings at 20% and 5%; at 0 → pause credit-consuming jobs, notify tenant owner, show a banner. Never block inbound processing.
- Monthly reset/grant on period renewal (job), with rollover rules from the plan.

### Integrations framework (every provider, now and future)
Every external service is **per tenant**: each business connects its own accounts and keys. This covers all current integrations (Claude, OpenAI, Google Places/PageSpeed, Hunter, Gmail, Outlook, SMTP/IMAP, LinkedIn, Meta, Google Calendar, Zoom) and any added later. Adding a new provider must need **no schema change**, only a new adapter + catalog entry.

**Provider catalog (in code):** one entry per provider:
- id, name, category (`AI`, `DATA`, `ENRICHMENT`, `EMAIL`, `SOCIAL`, `CALENDAR`, `MEETINGS`, `ADS`, `OTHER`)
- auth type: `API_KEY`, `OAUTH2`, `SERVER_TO_SERVER_OAUTH`, `SMTP_IMAP`, `WEBHOOK`
- credential fields schema (what the tenant must enter), OAuth scopes, docs/help link
- `healthCheck()` function, `refresh()` for OAuth tokens
- which platform features depend on it (e.g. AI replies need an AI provider + a mailbox)
- allows multiple connections or one (e.g. many mailboxes, one Hunter key)

**Tenant connection (`TenantIntegration`):** org, provider id, label, status (`CONNECTED`, `NEEDS_RECONNECT`, `ERROR`, `DISCONNECTED`), encrypted credentials (per-org encryption, never returned by any API), granted scopes, connected by, token expiry, last health check + last error, usage purpose (e.g. mailbox = inbox / outbound / both), metadata.

**OAuth providers (Google, Microsoft, LinkedIn, Meta, Zoom):** support two modes per provider:
- `PLATFORM_APP`: tenant clicks Connect and uses Delvix's OAuth app (easy for tenants; needs our app approved by each provider).
- `TENANT_APP`: tenant brings their own OAuth client ID/secret (works before our app is approved; good for agencies/enterprise).

**Plans control integrations:** plan features decide which providers/categories a tenant may connect and how many connections (e.g. Starter: 2 mailboxes, no Meta; Agency: 20 mailboxes, all providers).

**Shared services:**
- Token refresh job + "reconnect needed" notification to the tenant before tokens expire.
- Health check job per connection; failures show on the tenant setup checklist and in the Super Admin tenant health view.
- Webhooks (e.g. Meta lead ads) routed to the correct tenant via a per-tenant webhook ID, with signature verification.
- Disconnect = revoke token at provider (when supported) + wipe stored secret.
- Key rotation: tenant can replace a key without losing history.

**Platform rules stay in force for every provider:** no LinkedIn scraping or automated LinkedIn messaging, Meta messaging only within Meta's allowed windows, provider rate limits respected per tenant.

**Migration without breaking:** today's credentials (e.g. the existing user-level integration table) keep working. Add the catalog + `TenantIntegration` layer, copy existing connections into it (dry-run first), and route reads through one `integrationService.get(orgId, provider)` that falls back to the old storage until everything is moved. Old tables are not dropped.

### Usage metering
`UsageEvent` (org, metric, quantity, period, reference, createdAt) + monthly rollups. Every limited action calls one shared service:
`entitlements.check(orgId, metric, qty)` → allowed / blocked reason
`entitlements.consume(orgId, metric, qty, idempotencyKey)`
All Phase 1–5 jobs call this service (one place, no scattered checks).

### Invoices & payments
- `Invoice`: org, number (sequential per platform, e.g. DLX-2026-0001), period, line items (plan, extra credits, overage), subtotal, tax, total, currency, status (`DRAFT`, `OPEN`, `PAID`, `VOID`, `UNCOLLECTIBLE`), due date, paid at, PDF.
- `Payment`: invoice, amount, method (`MANUAL_BANK`, `WISE`, `PAYONEER`, `CARD_PROVIDER`), provider reference, status, received at, recorded by.
- **Payment provider adapter**. Start with **manual payments** (tenant pays via bank/Wise/Payoneer, super admin marks the invoice paid). Add an online provider later through the adapter (e.g. Paddle or Lemon Squeezy; confirm they support payouts for a Pakistan-based business first). Stripe is not directly available to Pakistan-based businesses.
- Credit top-up packs (buy extra credits) as invoice line items.

---

## Phases

### S1: Foundation (plans, subscriptions, entitlements, roles) in shadow mode
- Additive schema: Plan, Subscription, platform roles, PlatformAuditLog, UsageEvent.
- Seed plans: `OWNER` (internal, unlimited), plus 3 draft public plans (e.g. Starter / Growth / Agency; prices and limits editable later).
- Migrate: every existing org gets a subscription. Delvix/Default Workspace → `OWNER`. Any other existing orgs → `OWNER` too (or a trial) until decided. Dry-run first.
- Mark my user as `SUPER_ADMIN` via a script (not via UI).
- **Integrations framework:** provider catalog for all current providers, `TenantIntegration` model, `integrationService.get(orgId, provider)` with fallback to existing storage, copy existing connections (dry-run), health check + token refresh jobs, Settings → Integrations rendered from the catalog (so new providers appear automatically), plan-based provider/connection limits (shadow).
- `entitlementsService.check/consume`: reads plan limits + subscription status; **shadow mode** = logs what would be blocked, never blocks.
- Replace the existing ad-hoc limit check (e.g. the `inbox_accounts` check) with the entitlements service. Counts only ACTIVE records.
- Wire metering into Phase 1–5 jobs: sourcing, enrichment, audit/pitch, outbound send, AI reply draft/send.
- Tenant **Settings → Plan & Usage** page: current plan, status, usage meters vs limits (shadow).
- Tests: OWNER unlimited, shadow never blocks, counts only active, tenant isolation.

### S2: Credits ledger + enforcement
- CreditLedgerEntry, CreditPrice, cached balance, reserve/commit/refund, idempotency.
- Monthly grant job + rollover + expiry.
- Hook credit consumption into the same entitlements calls.
- Enforcement flag ON per org (start with a test org, never the OWNER org).
- Out-of-credits behavior: pause credit-consuming jobs, AI replies fall back to DRAFT_ONLY/hold (never auto-send without credits), inbound still processed, banner + email to tenant owner.
- Tenant UI: credit balance, ledger history, low-credit warnings.
- Tests: no double-charge on retries, refund on failure, enforcement blocks correctly, inbound never blocked.

### S3: Super Admin console (`/admin`, separate layout, SUPER_ADMIN only)
- **Overview:** tenants count, active/trial/past due/suspended, MRR, credits consumed this month, top tenants by usage, error rates.
- **Tenants list:** name, owner, plan, status, MRR, credits balance, usage %, last active, health (cron errors, bounce rate, paused mailboxes).
- **Tenant detail:** subscription (change plan, extend trial, suspend/reactivate with reason), credits (grant/adjust with reason), usage by metric, invoices/payments, integrations status (connected/healthy/error, **no secrets**), mailboxes health, autopilot toggles state, recent errors, members.
- **Plans:** create/edit plans, limits, features, credits, prices; private plans for specific tenants.
- **Credit prices:** edit per action type.
- **Audit log:** every super admin action (who, what, tenant, before/after, reason, time).
- Support view of a tenant = read-only; no impersonation in S3.
- Tests: only SUPER_ADMIN can access, every write audited, secrets never returned.

### S4: Billing, invoices, payments
- Invoice + Payment models, sequential numbering, PDF generation, invoice emails (system sender).
- Renewal job: create invoice at period start; mark PAST_DUE when unpaid after due date; grace period → SUSPENDED.
- Manual payment recording by super admin (mark paid, attach reference) → subscription ACTIVE + credits granted.
- Credit top-up packs.
- Payment provider adapter interface (manual now, online provider later).
- Tenant **Billing** page: plan, next invoice, invoices list + PDF download, how to pay, request upgrade.
- Tests: numbering unique, status transitions, payment activates subscription, idempotent renewals.

### S5: Self-serve onboarding
- Public signup → create org + owner user → TRIALING on chosen plan (trial credits).
- Onboarding wizard reusing the existing setup checklist: Business Brain, ICP, Services, connect own keys (Claude, Google Places, Hunter), connect mailboxes, branding, sending domain DNS check.
- Email verification, terms of service + acceptable use (no purchased lists, compliance with anti-spam laws) acceptance stored.
- Platform-wide abuse protection: per-tenant bounce/complaint monitoring, auto-pause tenant outbound on abuse signals, super admin alert.

---

## Things to decide later (not blocking S1–S3)
- **OAuth app approvals for many tenants:** Delvix's own OAuth apps (Google, Microsoft, LinkedIn, Meta, Zoom) each need the provider's review before many tenants can use them. Google Gmail reply-sync scopes need verification including a paid annual security assessment; Meta needs App Review for lead ads permissions; LinkedIn only allows limited APIs. Until approved, tenants use `TENANT_APP` mode (their own OAuth client) or SMTP + IMAP. Decide per provider before S5 goes public.
- Online payment provider choice.
- Final plan prices, limits, and credit prices.
- Taxes per country.
