# ROUTE AUDIT

**Date:** 2026-09-04  
**Source:** `src/app/**/page.tsx`, `src/app/api/**/route.ts`  
**Audit only**

---

## Target vs actual (customer UI)

Target routes are mostly **not** at root; they live under **`/dashboard/...`**. Several root aliases redirect into dashboard.

| Target | Actual | Status |
|--------|--------|--------|
| `/dashboard` | `/dashboard` | **Match** — home + analytics embedded |
| `/revenue`, `/revenue/forecast`, `/revenue/analytics` | Missing as routes; analytics on `/dashboard`; pipeline/revenue via deals | **MISSING / PARTIAL** |
| `/opportunities`, `/:id` | `/dashboard/opportunities`, `/dashboard/opportunities/[id]`; root `/opportunities` → redirect | **PARTIAL path mismatch** |
| `/companies`, `/:id` | **No UI pages**; data via opportunities/services | **MISSING** |
| `/contacts`, `/:id` | **No UI pages** | **MISSING** |
| `/sources`, `/:id` | `/dashboard/sources` (list only); root `/sources` redirect; no `:id` page | **PARTIAL** |
| `/business-brain` | `/dashboard/business-brain` (+ root redirect) | **PARTIAL path** |
| `/services`, `/:id` | `/dashboard/services` list; no dedicated `:id` page | **PARTIAL** |
| `/icp` | `/dashboard/icp` | **PARTIAL path** |
| `/revenue-goals`, `/:id` | `/dashboard/revenue-goals` list; API has `[id]` | **PARTIAL** |
| `/inbox`, `/:conversationId` | `/dashboard/conversations` (no deep link page verified) | **PARTIAL / rename** |
| `/campaigns`, `/:id` | `/dashboard/campaigns`, `[id]` | **PARTIAL path** |
| `/sequences`, `/:id` | **API only** — no dedicated UI page found | **MISSING UI** |
| `/tasks` | `/dashboard/tasks` | **PARTIAL path** |
| `/meetings`, `/:id` | `/dashboard/meetings` list; API `[id]`; no detail page | **PARTIAL** |
| `/proposals`, `/:id` | `/dashboard/proposals` list; API `[id]` | **PARTIAL** |
| `/deals`, `/:id` | `/dashboard/pipeline` (board); API `/api/deals` | **PARTIAL / rename** |
| `/ai-copilot` | Daily copilot **component on Dashboard**; `/dashboard/assistant` → agent | **PARTIAL** |
| `/revenue-agent`, `/approvals` | `/dashboard/agent` (approvals in same UI/API) | **PARTIAL path** |
| `/settings/profile|organization|team|integrations|security|billing` | Single `/dashboard/settings` with tabs | **PARTIAL** (consolidated) |
| Platform targets | `/platform`, `/platform/companies` (not `organizations`), users, activity, settings; **no `/platform/health` UI** (API `/api/health`) | **PARTIAL** |

---

## Customer pages (`/dashboard`)

| Route | Module | Purpose | Role access (UI nav / layout) | Primary APIs | DB entities | Status | Legacy/dup |
|-------|--------|---------|-------------------------------|--------------|-------------|--------|------------|
| `/dashboard` | Home | KPIs, checklist, copilot, analytics | All org users; analytics section needs `analytics.view` | `/api/analytics`, `/api/learning`, readiness | revenue, opps, learning | **COMPLETE** (product home) | Analytics merged here |
| `/dashboard/analytics` | Analytics | Redirect → dashboard | — | — | — | **Redirect** | Dup avoided |
| `/dashboard/opportunities` | Opportunities | List/workbench | `opportunities.view` | `/api/opportunities` | opportunities, companies | **COMPLETE** | — |
| `/dashboard/opportunities/[id]` | Opportunities | Detail + intel | `opportunities.view` | opp + research/score | opp, scores, intel | **COMPLETE** | — |
| `/dashboard/pipeline` | Deals | Kanban/pipeline | deals/opp view | `/api/deals` | deals | **COMPLETE** | Target name `/deals` |
| `/dashboard/leads` (+ new/edit/[id]) | Legacy CRM | Lead CRUD | `leads.*` | `/api/leads` | leads | **LEGACY** | Dual model |
| `/dashboard/campaigns` (+[id]) | Campaigns | Campaign mgmt | `campaigns.manage` (nav); API legacy role | `/api/campaigns` | campaigns, follow_ups | **PARTIAL** | Lead-tied |
| `/dashboard/autopilot` | Autopilot | Automation config | campaigns/agent nav; API `ai:use` | `/api/autopilot` | autopilot_configs | **PARTIAL** | — |
| `/dashboard/agent` | Revenue Agent | Goals/runs/approvals | `agent.view` | `/api/agent/*` | agent_* | **PARTIAL** (UI > executor) | — |
| `/dashboard/assistant` | — | Redirect → agent | — | — | — | **Redirect** | — |
| `/dashboard/conversations` | Inbox | Unified inbox | `conversations.view` | `/api/conversations`, inbox sync | inbox_conversations, messages | **COMPLETE*** | Not `/inbox` |
| `/dashboard/meetings` | CRM | Meetings list | opp/deals | `/api/meetings` | meetings | **PARTIAL** (no :id page) | — |
| `/dashboard/proposals` | CRM | Proposals list | `deals.manage` | `/api/proposals` | proposals | **PARTIAL** | — |
| `/dashboard/tasks` | Tasks | Task list | leads/opp | `/api/tasks` | tasks | **COMPLETE** | — |
| `/dashboard/business-brain` | Brain | Profile/docs | `business_brain.manage` | `/api/business-brain/*` | business_* | **COMPLETE** | — |
| `/dashboard/services` | Catalog | Services/offers | brain manage | `/api/services`, offers | services, offers | **PARTIAL** (no :id) | — |
| `/dashboard/icp` | ICP | ICP editor | brain manage | `/api/icps` | icps | **COMPLETE** | — |
| `/dashboard/revenue-goals` | Goals | Revenue targets | goals/revenue | `/api/revenue-goals` | revenue_goals | **PARTIAL** | — |
| `/dashboard/sources` | Sources | Connectors | `integrations.manage` | `/api/source-connectors` | source_* , signals | **PARTIAL** (no :id) | — |
| `/dashboard/settings` | Settings | Team, billing, integrations tabs | legacy `settings:read` | billing, members, integrations | many | **PARTIAL** vs split settings | — |
| `/dashboard/platform` | — | Redirect → `/platform` | — | — | — | **Redirect** | — |

\*Requires connected email OAuth for full realism.

### Root aliases (redirects)

`/opportunities`, `/sources`, `/business-brain`, `/services`, `/icp`, `/revenue-goals` → corresponding `/dashboard/...`

---

## Auth / public pages

| Route | Purpose | Status |
|-------|---------|--------|
| `/` | Marketing/home | Present |
| `/login`, `/signup` | Auth | Present |
| `/invite`, `/forgot-password`, `/reset-password` | Lifecycle | Present |
| `/privacy`, `/terms` | Legal | Present |

---

## Platform pages (`/platform`)

| Route | Purpose | Access | Status |
|-------|---------|--------|--------|
| `/platform` | Overview | SUPER_ADMIN layout | Present |
| `/platform/companies` | Orgs list | SUPER_ADMIN | Present (not `/organizations`) |
| `/platform/companies/[id]` | Org detail | SUPER_ADMIN | Present |
| `/platform/users` | Users | SUPER_ADMIN | Present |
| `/platform/activity` | Activity | SUPER_ADMIN | Present |
| `/platform/settings` | Platform settings | SUPER_ADMIN | Present |
| `/platform/health` | — | — | **MISSING UI** (use `GET /api/health`) |

Layout forces non–super-admin away from `/platform`; super-admin away from `/dashboard`.

---

## API inventory (105 routes)

### Auth
`/api/auth/{login,logout,signup,me,profile,change-password,forgot-password,reset-password}`

### Platform
`/api/platform/organizations`, `[id]`, `[id]/members`

### Org / team
`/api/organizations`, `/api/organizations/members`, `[userId]`, `/api/users`, `[id]`, `/api/invitations/accept`, `/api/tags`

### Revenue OS
`/api/business-brain/{profile,documents,documents/[id],context}`  
`/api/services`, `[id]` · `/api/offers`, `[id]` · `/api/icps`, `[id]` · `/api/revenue-goals`, `[id]`, `parse`  
`/api/source-connectors`, `[id]`, `[id]/run`, `runs`  
`/api/opportunities`, `[id]`, `[id]/score`, `[id]/research`

### Legacy leads / automation
`/api/leads`, `[id]`, `bulk`, `import`, `[id]/tasks|notes|activities`  
`/api/campaigns`, `[id]`, `stats`, `discover`  
`/api/automation/start`, `[leadId]` · `/api/autopilot`  
`/api/linkedin/{discover,import,account}` · LinkedIn OAuth

### Inbox / email
`/api/conversations`, `[id]` · `/api/inbox/sync`  
`/api/email-accounts`, `[id]`, `[id]/sync` · `/api/email-suppressions`  
Gmail/Outlook OAuth + `/api/integrations/email`

### CRM
`/api/deals`, `[id]` · `/api/meetings`, `[id]` · `/api/proposals`, `[id]` · `/api/tasks`, `[id]`  
`/api/sequences`, `[id]`

### Analytics / AI / agent / billing
`/api/analytics` · `/api/learning` · `/api/ai-recommendations`, `[id]`  
`/api/ai/{outreach,usage,research/[leadId]}`  
`/api/agent/{goals,goals/[id],runs,runs/[id],approvals}`  
`/api/plans` · `/api/billing`, `checkout`, `portal`, `webhook`  
`/api/privacy/data` · `/api/health`  
`/api/cron/automation` · `/api/webhooks/website-visitors`  
Integrations: openai, anthropic, `[platform]`, list

**Server Actions:** none (`"use server"` not used).

---

## Duplicate / confusing surfaces

| Issue | Detail |
|-------|--------|
| Leads + Opportunities | Two CRM entry points |
| Conversations (legacy lead) vs Inbox conversations | Two message models |
| Campaigns vs Sequences vs Autopilot vs Agent | Overlapping automation concepts |
| Pipeline vs Deals naming | UI says Pipeline; API says deals |
| Analytics as page vs section | Page redirects; content on Dashboard |
| Root vs `/dashboard` aliases | Harmless redirects |

---

## STOP

No route renames or new pages implemented. Route alignment to target IA is a product decision for later approval.
