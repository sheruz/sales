# Architecture Audit — Sales Platform / AI Revenue Platform

**Date:** 2026-09-03  
**Codebase:** `sales-platform` (Next.js 16.3.4, Prisma 6, PostgreSQL)  
**Purpose:** Phase 0 prerequisite before Phase 1 multi-tenancy.

---

## 1. Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 App Router, React 19, TypeScript |
| UI | Tailwind v4, Base UI / shadcn-style components |
| API | Route Handlers (`src/app/api/**`) — no Server Actions for core CRUD |
| ORM | Prisma 6 (`prisma/schema.prisma`) |
| Auth | Session tokens in HTTP-only cookies (`session_token`) |
| AI | OpenAI / Anthropic via BYOK (`UserIntegration` encrypted credentials) |
| Email | Nodemailer SMTP (BYOK) |
| Jobs | Cron route `POST /api/cron/automation` + inline async autopilot |
| Tests | **None present** before Phase 1 |

---

## 2. Existing Tables (summary)

| Table | Purpose | Tenant today | Maps to target |
|-------|---------|--------------|----------------|
| `users` | Auth identity + legacy `UserRole` | Shared | Users (+ platform vs org membership) |
| `sessions` | Login sessions | User-scoped | Sessions + `active_organization_id` |
| `companies` | **Prospect** companies (CRM), not tenants | Shared | Companies (buyer accounts) under org |
| `leads` | Prospects / contacts | Shared (role-scoped only) | Contacts / Opportunities precursor |
| `tags`, `lead_tags` | Lead tagging | Shared | Org-scoped tags |
| `campaigns`, `campaign_leads` | Outreach campaigns | Shared | Campaigns |
| `linkedin_discovery_jobs` | Discovery jobs | User | Opportunity sources / jobs |
| `lead_researches`, `lead_scores` | AI research | Via lead | Opportunity intelligence |
| `notes`, `tasks`, `activities` | CRM activity | Via lead/user | Tasks / activity |
| `conversations` | Outreach messages | Via lead | Conversations |
| `email_*` | Email threads (partial) | Shared / unused UI | Email |
| `follow_up_sequences`, `follow_up_jobs` | Follow-ups | Via campaign/lead | Sequences |
| `deals`, `deal_activities` | Pipeline | Shared / placeholder UI | Deals |
| `meetings`, `meeting_notes` | Meetings | Shared / placeholder | Meetings |
| `proposals`, `proposal_versions` | Proposals | Shared / placeholder | Proposals |
| `services` | What company sells | Global catalog | Org Business Brain services |
| `integration_products` | Marketplace catalog | Platform | Billing/catalog |
| `user_integrations` | BYOK keys | Per user | Org/user integrations |
| `user_outreach_settings` | AI/channel prefs | Per user | Org settings + user prefs |
| `linkedin_accounts` | LinkedIn OAuth/session | Per user | Integrations |
| `autopilot_configs` | Autopilot | Per user | Automation |
| `ai_conversations`, `ai_usage_logs` | AI chat/usage | User / loose | AI / Learning |
| `audit_logs` | Audit | User optional | Audit (add org) |
| `settings` | Global KV | Platform | Platform settings |

**Critical naming:** `companies` = prospect firms, **not** SaaS tenants. Tenants will be `organizations`.

---

## 3. Auth / RBAC (pre–Phase 1)

Legacy enum `UserRole`: `SUPER_ADMIN`, `ADMIN`, `SALES_MANAGER`, `SALES_REPRESENTATIVE`.

Permissions are hard-coded in `src/lib/auth/permissions.ts`.  
`/platform` is Super Admin only; `/dashboard` redirects Super Admin away.

**Gap:** No `organization_id`. Role checks ≠ tenant isolation. Any authenticated user who can guess UUIDs may reach other users’ records depending on service filters (often only soft-delete / role scope).

---

## 4. Routes (high level)

| Area | Status |
|------|--------|
| `/login`, `/` | Working |
| `/platform/*` | Working (Super Admin shell) |
| `/dashboard/*` leads, campaigns, autopilot, conversations, tasks, settings | Working / partial |
| Pipeline, meetings, proposals, analytics, assistant | Placeholder |
| APIs under `/api/*` | Working; auth via `requirePermission` |

---

## 5. Features status

| Feature | Status |
|---------|--------|
| Login/logout, profile, password | Working |
| Super Admin vs Company Admin UI split | Working (not multi-tenant) |
| Leads CRM + CSV | Working |
| Campaigns + LinkedIn discover | Partial |
| Autopilot job-post → email | Working |
| BYOK OpenAI/Anthropic/SMTP/LinkedIn OAuth | Working |
| Follow-ups cron | Working |
| Conversations + reply AI | Partial (simulate inbound) |
| Deals/meetings/proposals UI | Placeholder |
| Self-signup, billing, invite accept | Missing |
| Tenant isolation | **Missing — Phase 1** |

---

## 6. Cron / jobs

- `POST /api/cron/automation` — follow-ups + all enabled autopilots  
- Autopilot `POST /api/autopilot` — background run  
- No Redis/BullMQ in active use  

---

## 7. Migration strategy (Phase 1)

1. Add `organizations`, membership, roles, permissions, invitations, org settings.  
2. Add `organization_id` to all tenant-owned tables.  
3. Backfill one default organization for existing non–super-admin data.  
4. Keep `users.role` for compatibility; sync with `roles` / `organization_users`.  
5. Enforce org scope in session + every service query.  
6. Do **not** rename `companies` (prospects); tenants are `organizations`.

---

## 8. Production build

Build pipeline: `scripts/build.js` (loads `.env`, forces `NODE_ENV=production`). Dashboard is `force-dynamic`.
