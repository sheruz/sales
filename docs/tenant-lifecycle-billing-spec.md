# Delvix Revenue OS: Tenant Lifecycle, Packages & Payments (Complete Flow)

This spec defines the full journey of a company (tenant) on the platform, from the moment the Super Admin creates it to paying, using modules, upgrading, failing payment, cancelling and leaving. It replaces the open parts of S3/S4 in `docs/saas-platform-plan.md` and must be built in the phases at the end (B1 → B5), each with audit → GO → implement → test.

Ground rules (same as before):
- Additive schema only; dry-run scripts; backups before apply.
- Delvix workspace (`PLATFORM_OWNER_ORG_ID`) is never locked, never billed, never enforced.
- Locking is enforced in **four layers**: navigation, page routes (server-side), API routes, and background jobs. Hiding a menu item alone is not security.
- Inbound safety: for SUSPENDED (payment problem) tenants, inbox sync, bounces, unsubscribes and suppression keep working. Replies are never lost.
- One gateway (`billing.authorize`) decides access; every module asks it.

---

## 1. No self-registration: the Super Admin creates companies

**Super Admin → Tenants → "New company"**
Fields:
- Company name, slug (auto), country, timezone, currency (default USD)
- Owner/admin: first name, last name, email
- Access option (pick one):
  1. **No package yet**: company must choose and pay online on first login (default)
  2. **Trial**: choose a package + trial days (e.g. 7 or 14); converts to paid via checkout before trial ends
  3. **Manual / invoiced**: assign a package paid outside Stripe (bank/Wise/Payoneer); Super Admin records payments
  4. **Complimentary**: package with no charge (partners/testing), with optional end date
- Optional notes (internal)

On save:
- Organization created with status `INVITED`
- Owner user created (no password yet) with org role `company_admin`
- **Invite email** sent from the platform system sender with a secure set-password link (single use, expires in 72 hours)
- Super Admin can **Resend invite**, **Copy invite link**, **Change owner email**, **Cancel invite**
- Audit log entry

**Organization status** (separate from subscription): `INVITED` → `ACTIVE` (owner set password) → `ARCHIVED` (Super Admin closed it). Archived orgs cannot log in; data retained per retention policy.

---

## 2. Subscription states (what the company can do)

| State | How it happens | Access |
|---|---|---|
| `NONE` | Created with "No package yet" | **Locked**: only the Choose Plan screen, Billing, My account, logout |
| `TRIALING` | Super Admin granted trial | Modules allowed by the trial package; banner "Trial ends in X days — choose a plan" |
| `ACTIVE` | Paid via Stripe, manual payment recorded, or complimentary | Modules allowed by the package |
| `PAST_DUE` | Renewal payment failed | Full package access during **grace period** (default 7 days) + red banner "Update payment method" |
| `SUSPENDED` | Grace period ended unpaid, or Super Admin suspended | **Read-only**: can view data and pay; all outbound/automation paused; inbound sync, bounces, unsubscribes keep running |
| `CANCELED` | Company cancelled (effective at period end) or Super Admin cancelled | Until period end: normal. After period end: **read-only + export for 30 days**, all jobs and inbox sync stopped, then data retention policy |
| `EXPIRED` | Trial ended without payment | Same as `NONE` (locked) but data created during trial is kept |

Transitions are driven by Stripe webhooks (or Super Admin actions for manual/complimentary) and a daily lifecycle job (trial expiry, grace expiry, cancellation end).

---

## 3. The locked experience (no package)

When the company admin logs in for the first time:
1. Sets password via invite link → logs in.
2. **Every module is locked.** Any app URL redirects server-side to **/billing/choose-plan**. Every module API returns `403 {reason: "NO_ACTIVE_SUBSCRIPTION"}`. No cron/background job runs for this org.
3. Sidebar shows modules with a lock icon (so they can see what they're buying) but clicking opens the plan page.
4. **Choose Plan page**:
   - Header: "Welcome, {Company}. Choose a plan to activate your workspace."
   - Monthly / Yearly toggle (yearly shows the saving)
   - 4 plan cards: price, credits/month, key limits, included modules (checkmarks), "Most popular" badge on Growth
   - Comparison table below (all limits and modules)
   - "Talk to us" link (Super Admin email) for custom/Agency
   - Button "Choose {plan}" → payment checkout
5. Also accessible while locked: **My account** (profile, password), **Billing** (invoices if any), **Logout**. Nothing else.

Other company users (if invited later) see a simple screen: "Your workspace is not active yet. Ask your admin to choose a plan." Only `company_admin` (permission `billing.manage`) can pay.

---

## 4. Checkout and activation

1. "Choose plan" → server creates a provider checkout session (Stripe Checkout in subscription mode) with the org's provider customer (created once per org), the plan's price ID, and metadata `{organizationId, planId, interval}`.
2. Company pays on the Stripe page.
3. Return URL → **/billing/activating**: shows "Activating your workspace…" and **polls the server**. Activation happens only when the verified webhook is processed, never because the browser returned (the redirect can be faked or lost).
4. Webhook `checkout.session.completed` / `customer.subscription.created` / `invoice.paid` → subscription `ACTIVE`, plan + period dates stored, **monthly credits granted** (ledger, idempotency key = provider invoice ID), modules unlocked, welcome email.
5. The activating page detects ACTIVE → redirects to the **onboarding wizard**:
   1. Business profile (services, prices, case studies)
   2. Target customers (ICP), with templates by niche
   3. Integrations (connect own keys: Claude, Google Places, Hunter…), only those allowed by the package
   4. Mailbox (connect Gmail/Outlook/SMTP), plus a DNS check
   5. Email branding + business address (anti-spam compliance)
   6. "Start Autopilot" (shadow mode first)
   The wizard can be skipped and resumed; the setup checklist shows progress.
6. Cancel/failed checkout → back to Choose Plan with a message; nothing unlocked.
7. Safety net: if the webhook is delayed, the activating page waits up to 60s, then says "Payment received, activation is taking longer than usual". Super Admin has **"Resync from Stripe"** on the tenant page.

---

## 5. Packages (proposed; Super Admin can edit everything)

Pricing assumes tenants bring their own keys (BYOK), so Delvix's cost per tenant is low. Credit costs: Google sourcing page = 1, enrichment = 2, audit+pitch = 2, AI reply draft = 1, crawl/classification/email/meeting = 0. One fully processed lead ≈ 4 credits.

| | **Starter** | **Growth** (most popular) | **Pro** | **Agency** |
|---|---|---|---|---|
| Price / month (USD) | $49 | $149 | $299 | $599 |
| Price / year | $490 | $1,490 | $2,990 | $5,990 |
| Credits / month | 600 (~150 leads) | 2,000 (~500 leads) | 5,000 (~1,250 leads) | 12,000 (~3,000 leads) |
| Credit rollover | No | Up to 1 month | Up to 1 month | Up to 2 months |
| Users | 1 | 3 | 10 | 25 |
| Sending mailboxes | 2 | 5 | 15 | 40 |
| Emails / day (all mailboxes) | 60 | 250 | 750 | 2,000 |
| Emails / month | 1,500 | 6,000 | 18,000 | 50,000 |
| ICPs (target profiles) | 1 | 3 | 10 | Unlimited |
| Active campaigns | 2 | 10 | 30 | Unlimited |
| **Modules** | | | | |
| Leads (companies, contacts) | ✓ | ✓ | ✓ | ✓ |
| Autopilot sourcing + crawl | ✓ | ✓ | ✓ | ✓ |
| Enrichment | ✓ | ✓ | ✓ | ✓ |
| Website audit + AI pitch | ✓ | ✓ | ✓ | ✓ |
| Outreach (sequences, sending) | ✓ | ✓ | ✓ | ✓ |
| Inbox + AI reply drafts | ✓ | ✓ | ✓ | ✓ |
| AI auto-send replies | – | ✓ | ✓ | ✓ |
| Meetings (Calendar + Zoom/Meet booking) | – | ✓ | ✓ | ✓ |
| Deals / pipeline / proposals | ✓ | ✓ | ✓ | ✓ |
| Meta Lead Ads | – | ✓ | ✓ | ✓ |
| LinkedIn assist | – | ✓ | ✓ | ✓ |
| Analytics (advanced) | Basic | ✓ | ✓ | ✓ |
| Personal audit pages (Signal engine, later) | – | – | ✓ | ✓ |
| White-label branding (remove Delvix branding) | – | – | – | ✓ |
| API access | – | – | – | ✓ |
| Priority support | – | – | ✓ | ✓ |
| Credit top-up packs | ✓ | ✓ | ✓ | ✓ |

Credit top-up packs (one-time purchase, never expire while subscribed): 500 = $29, 2,000 = $99, 5,000 = $219.

Internal plans (never shown to tenants): `OWNER` (Delvix), `COMPLIMENTARY`, private custom plans per tenant.

Existing plans `Free / Growth / Scale` from earlier code: archive (keep rows) and migrate any assignments; the Test Tenant moves to Starter.

---

## 5b. Packages are dynamic (editing a package updates companies)

Nothing about a package is hard-coded. Every limit, feature, credit amount and module comes from the database, and every check reads the **effective entitlements** at the moment of use:

`effective = current package version (limits + features + credits) + per-tenant overrides`

Rules when the Super Admin edits a package:
- **Plan versions:** saving a change creates a new version of the package (history kept). The editor asks how to apply it:
  - **Apply to all companies on this package now** (default for increases and new features)
  - **Apply at each company's next renewal** (recommended for decreases)
  - **New subscribers only** (existing companies stay on their current version, i.e. "grandfathered")
- **Limits and features:** applied per the choice above. No code change or redeploy is ever needed.
- **Credits per month:** take effect from each company's next credit grant (never retroactively removed).
- **Price:** never changes for existing subscribers automatically. New price applies to new subscribers; moving existing subscribers to the new price is a separate, explicit bulk action (provider price migration, audit-logged).
- **Lowering a limit below current usage** (e.g. mailboxes 5 → 3 while a company has 5): nothing is deleted. Extra items are **paused** (newest first, or the company admin chooses), the company sees a banner and gets an email. If applied "now", give a notice period (default 7 days) before pausing.
- **Removing a module from a package:** the module locks for affected companies per the chosen timing; their data stays and becomes visible again if they upgrade.
- **Per-tenant overrides always win** over the package (e.g. one company gets 10 extra mailboxes) and survive package edits.
- **Preview before saving:** the editor shows "This change affects N companies; M of them are above the new limits" with the list.
- Every package change is audit-logged with before/after, who, when, and apply mode.

## 6. Module gating map (single source of truth)

Each module has a **feature key**. The plan (plus per-tenant override) turns it on or off. One file defines it, used by nav, page guards, API guards and jobs.

| Module | Feature key | Pages | APIs | Jobs |
|---|---|---|---|---|
| Home/Dashboard | `dashboard` | / | dashboard APIs | – |
| Leads | `leads` | companies, contacts | companies/contacts APIs | – |
| Autopilot: sourcing + crawl | `autopilot_sourcing` | autopilot sourcing tab | sourcing APIs | sourcing/crawl cron |
| Autopilot: enrichment | `autopilot_enrichment` | enrichment tab | enrichment APIs | enrichment cron |
| Autopilot: audit + pitch | `autopilot_audit` | audit + pitch review tabs | audit/pitch APIs | audit cron |
| Outreach | `outreach` | campaigns, sequences, mailboxes | outreach APIs | outbound send cron |
| Inbox | `inbox` | inbox | inbox APIs | inbox sync (special rules) |
| AI reply drafts | `ai_replies` | inbox drafts, replies tab | ai-reply APIs | ai-reply cron |
| AI auto-send | `ai_auto_send` | mode setting | – | auto-send |
| Meetings | `meetings` | meetings | meetings/booking APIs | reminders |
| Deals | `deals` | pipeline, opportunities, proposals | deals APIs | – |
| Meta Lead Ads | `meta_lead_ads` | integration + autopilot tab | webhook | – |
| LinkedIn assist | `linkedin_assist` | LinkedIn tasks | APIs | – |
| Analytics advanced | `analytics_advanced` | analytics pages | APIs | – |
| White-label | `white_label` | branding options | – | – |
| API access | `api_access` | API keys page | public API | – |
| Team | always on (limited by `users` seats) | team | team APIs | – |
| Settings (business, ICP, integrations) | on when subscription allows any module | settings | settings APIs | – |

Locked UI behavior per module: menu item with a lock icon + "Available on Growth" tag; opening it shows an upgrade card (what it does, which plan has it, "Upgrade" button), never a broken page.

---

## 7. Plan changes, cancellation, payment problems

**Upgrade** (e.g. Starter → Growth): immediate. The provider prorates the charge. Credits: grant the **difference** between the new and old monthly credits for the current period (ledger, idempotent). New modules unlock immediately.

**Downgrade** (e.g. Growth → Starter): scheduled for **period end**. Before it takes effect, the company sees what will change ("You use 4 mailboxes, Starter allows 2 — choose which 2 stay active"). At the switch: extra mailboxes/users/campaigns become **paused** (not deleted), modules not in the new plan lock, credits follow the new plan from the next grant.

**Cancel**: Plan & Billing → Cancel → reason (optional) → effective at period end; "Resume subscription" available until then. After the period end → `CANCELED` rules (section 2).

**Payment failed**: provider retries (smart retries). `PAST_DUE` + banner + email to the admin, day 0, day 3 and day 6. After the grace period → `SUSPENDED`. Paying (via the customer portal) → `ACTIVE` immediately and paused jobs resume.

**Refund / dispute** (handled in the provider dashboard): webhook → Super Admin alert; dispute → auto-`SUSPENDED` until resolved.

**Customer self-service** (provider customer portal): update card, download invoices/receipts, change billing email.

**Monthly renewal**: `invoice.paid` → new period dates → monthly credit grant (rollover rules) → usage counters reset for monthly limits.

---

## 8. Super Admin console (what you see and control)

- **Overview**: MRR, ARR, active / trialing / past-due / suspended / canceled counts, new this month, churn, revenue this month, credits consumed, top tenants by usage, failed payments needing attention, platform warnings (e.g. enforcement kill switch off).
- **Tenants list**: company, owner, status, plan, interval, MRR, next renewal, credits balance, usage %, last active, health (errors, bounce rate, paused mailboxes). Filters and search.
- **Tenant detail**:
  - Profile + owner (resend invite, change owner)
  - Subscription: plan, status, period, provider links (open in Stripe), payment history, invoices
  - Actions: assign/change plan, start/extend trial, record manual payment, make complimentary, suspend/reactivate, cancel, archive, resync from Stripe
  - Credits: balance, ledger, grant/adjust (with reason)
  - Overrides: any limit/feature for this tenant only (with reason, optional expiry)
  - Usage by module this period; integrations status (connected/healthy, never secrets); mailbox health; autopilot state; recent errors
  - Read-only support view of their workspace (audit-logged)
- **Packages**: create/edit/archive plans: prices, trial days, credits, rollover, limits, features (module checklist from the gating map), visibility (public/private/internal), "Most popular" flag, display order. **Publish** syncs provider product + prices. Price changes create new provider prices; existing subscribers keep theirs unless migrated (bulk "move subscribers to new price" action, audit-logged).
- **Credit prices**: cost per action (BYOK/MANAGED).
- **Top-up packs**: create/edit.
- **Payments settings**: provider connected yes/no, TEST/LIVE mode, webhook URL + last event + failures. Keys only in server `.env`, never shown.
- **Emails**: templates for invite, welcome, trial ending, payment failed, suspended, canceled, low credits (system sender).
- **Audit log**: every Super Admin action with before/after and reason.

---

## 9. Emails sent by the platform (system sender, never tenant cold mailboxes)

Invite (set password) · Welcome after activation · Trial ending (3 days and 1 day before) · Trial expired · Payment receipt (provider sends) · Payment failed (day 0/3/6) · Suspended · Reactivated · Cancellation scheduled · Canceled + export reminder · Low credits 20% / 5% / out of credits · Downgrade reminder (7 days before).

---

## 10. Payment provider

- Adapter interface: `createCustomer`, `syncProductAndPrices`, `createCheckoutSession` (subscription + one-time top-up), `createPortalSession`, `changeSubscription` (upgrade/downgrade with proration), `cancelSubscription`, `resumeSubscription`, `verifyWebhook`, `mapEvent`.
- Implement **Stripe** first (test mode now). Design so **Paddle / Lemon Squeezy / Manual** can be added without schema changes.
- Live Stripe payments require a business registered in a Stripe-supported country (e.g. a US LLC or UK company). Test mode can be used for development regardless.
- Webhooks: signature-verified, stored (`BillingWebhookEvent`), idempotent, processed in order per subscription, retried on failure, with a Super Admin view of failures.
- Events handled: checkout.session.completed, customer.subscription.created/updated/deleted, invoice.paid, invoice.payment_failed, invoice.upcoming (renewal notice), charge.refunded, charge.dispute.created.

---

## 11. Build phases

Each phase: audit → plan → my GO → implement → tests → Linux runbook (backup → dry-run → GO → apply → build → `pm2 restart sales` only).

**B1: Access control & tenant lifecycle (no payments yet)**
- Organization status (INVITED/ACTIVE/ARCHIVED), subscription states (NONE, TRIALING, ACTIVE, PAST_DUE, SUSPENDED, CANCELED, EXPIRED)
- Super Admin "New company" + invite flow + manual plan assignment / trial / complimentary
- Module gating map + 4-layer enforcement (nav, page guard, API guard, jobs)
- Locked experience + Choose Plan page (checkout button disabled with "Payments coming soon" until B3, or Super Admin activates manually)
- Lifecycle daily job (trial expiry, grace expiry, cancel end)
- Seed the 4 packages (Starter/Growth/Pro/Agency) with the limits/features above; archive old Free/Growth/Scale; move Test Tenant to Starter
- Tests: locked org cannot access any module page/API/job; each feature key gates correctly; OWNER unaffected; suspended keeps inbound; canceled read-only

**B2: Packages editor + provider sync**
- Super Admin Packages UI, credit prices, top-up packs, overrides UI
- Stripe adapter: product/price sync on publish; payments settings status page

**B3: Checkout, webhooks, self-service**
- Choose plan → checkout → activating page → webhook activation → onboarding wizard
- Upgrade/downgrade/cancel/resume, customer portal, top-up purchase
- Payment failed → grace → suspend → recover; refunds/disputes
- Monthly renewal credit grants; resync from Stripe
- End-to-end test scenarios in Stripe test mode (see section 12)

**B4: Super Admin tenants & revenue**
- Overview metrics, tenants list/detail, all actions, support view, audit log UI

**B5: Emails & polish**
- All lifecycle emails, banners, onboarding wizard polish, downgrade "choose what stays active" flow

Then: Phase 6 (meetings).

---

## 12. End-to-end test scenarios (Stripe test mode)

1. Super Admin creates company "Acme" (no package) → invite email → set password → login → everything locked → Choose Plan visible; direct URL to /leads redirects; API returns 403; no cron runs for Acme.
2. Acme chooses Growth monthly → pays with test card `4242 4242 4242 4242` → activating page → webhook → ACTIVE → 2,000 credits granted → Growth modules unlocked, Pro/Agency modules show upgrade cards → onboarding wizard.
3. Acme upgrades to Pro → prorated charge → credit difference granted once → Pro modules unlocked.
4. Acme downgrades to Starter → scheduled → at period end extra mailboxes paused, AI auto-send/meetings locked.
5. Renewal with a card that fails (Stripe test card for failed payment) → PAST_DUE + banner + email → grace ends → SUSPENDED (outbound paused, inbox still syncing) → pay via portal → ACTIVE, jobs resume.
6. Acme cancels → active until period end → CANCELED → read-only + export.
7. Super Admin creates "Beta Co" with 14-day trial on Growth → trial banner → trial ends without payment → EXPIRED (locked, data kept) → pays → ACTIVE.
8. Super Admin creates "Partner Co" complimentary Agency → all modules, no billing.
9. Duplicate webhook delivery → no double credits; invalid signature → rejected.
10. Delvix workspace unaffected through all of the above.