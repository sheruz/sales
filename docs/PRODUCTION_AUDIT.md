# PRODUCTION AUDIT — Sales Platform (AI Revenue SaaS)

**Date:** 2026-09-04  
**Codebase:** `sales-platform`  
**Mode:** **AUDIT ONLY** — no code, schema, route, or behavior changes were made  
**Companion docs:**

- [`DATABASE_AUDIT.md`](./DATABASE_AUDIT.md)
- [`ROUTE_AUDIT.md`](./ROUTE_AUDIT.md)
- [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md)
- [`FEATURE_GAP_MATRIX.md`](./FEATURE_GAP_MATRIX.md)

**Method:** Inspected Prisma schema, App Router pages, 105 API routes, services, permission catalogs, connector registry, agent policy, billing/entitlements, and existing Vitest contracts. Prior phase “Done” docs were **not** treated as proof.

---

## Product model (verified)

Intended chain:

Business Brain → Revenue Goal → ICP → Sources → **Signals** → Companies → Contacts → **Opportunities** → AI Intelligence → Service/Offer → Outreach → Conversations → Meetings → Proposals → Deals → Revenue → Analytics → Learning → Revenue Agent

**Actual:** This chain **exists in schema and core services**, with important caveats:

- **Signals ≠ Opportunities** is real (`Signal` + fingerprint dedupe → optional opportunity create).
- **Companies/Contacts** exist in DB and ingest path but lack first-class UI/API.
- **Legacy Leads** still power campaigns, follow-ups, LinkedIn discover, and much automation.
- **Sequences** are definitions without enrollment runtime.
- **Revenue Agent** UI/orchestration is real; many planned actions are acknowledge/deferred only.

Two surfaces confirmed:

| App | Path | Users |
|-----|------|-------|
| Customer | `/dashboard` | Org roles via membership |
| Platform | `/platform` | `UserRole.SUPER_ADMIN` only (layout-enforced) |

---

## AUDIT 1 — Database

See **DATABASE_AUDIT.md** for full table.

**Highlights:**

- Tenant core (orgs, RBAC, brain, ICP, goals, companies, contacts, connectors, signals, opportunities, scores, intel, inbox messages, deals, revenue, plans, subscriptions, agent_*) **exists and is used**.
- **Missing:** `notifications`, `sequence_enrollments`, unified `background_jobs`.
- **Dangerous:** `notes`, `activities`, `job_logs` without `organizationId`.
- **Legacy heavy:** `leads` + lead research/scores + campaign_leads + lead `conversations`.

---

## AUDIT 2 — Multi-tenancy

**Context path:** login → hashed session cookie → `getCurrentUser` → `activeOrganizationId` / primary membership → `permissions[]`.

| Layer | Finding |
|-------|---------|
| Middleware | Cookie presence only for `/dashboard` & `/platform` |
| APIs | Mix of `requireOrgPermission` and legacy `requirePermission` |
| Server Actions | **None** |
| Jobs/cron | Iterate orgs with `organizationId` on follow-ups/connectors; `job_logs` unscoped |
| Webhooks | Stripe + visitor webhook secret-bound |

**IDOR Org A → Org B opportunity id:** **Blocked** (org-scoped opportunity service).

**IDOR still possible:** lead notes, lead activities, AI research by `leadId` (see SECURITY_AUDIT).

---

## AUDIT 3 — RBAC

**Org roles (canonical catalog):** company_admin, sales_manager, sales_rep, viewer.  
**User enum:** SUPER_ADMIN, ADMIN, SALES_MANAGER, SALES_REPRESENTATIVE — **no Viewer enum**.

Backend enforcement is **inconsistent**. Nav uses org permissions; many APIs use legacy `UserRole`. Treat frontend gates as non-authoritative.

Full matrix and risks: **SECURITY_AUDIT.md**.

---

## AUDIT 4 — Routes & UI

See **ROUTE_AUDIT.md**.

- Product lives under `/dashboard/*`, not target root paths (`/opportunities`, `/inbox`, …).
- **Missing UI:** companies, contacts, sequences, revenue forecast IA, platform health page, many `:id` detail pages.
- Analytics is **on Dashboard** (old analytics route redirects).
- Agent is `/dashboard/agent` (not `/revenue-agent`).

---

## AUDIT 5 — Core revenue model (Signal → Opportunity)

| Question | Actual behavior |
|----------|-----------------|
| What creates a signal? | Connector adapters → `NormalizedSignalRecord` → `opportunityService.ingestNormalizedSignal` |
| What creates an opportunity? | Ingest path after company/contact/signal (not every raw lead/job automatically; lead automation is separate legacy path) |
| Attach to companies? | `companyService.findOrCreate` by name/domain |
| Contacts? | Optional on record; email dedupe per company |
| Multiple signals? | New signals on company; opportunity can keep primary signal / lastSignalAt (combine logic is ingest/score oriented, not a rich multi-signal graph UI) |
| Dedup? | Org-scoped **fingerprint** unique; `resolveSignalDedupe` can skip |
| Score? | `scoreOpportunity` rules_v1 dimensions → `OpportunityScore` |
| Stage? | `OpportunityStage` enum + events; CRM actions advance stages |

**Verdict:** Signal/Opportunity distinction is **real** in the new path. Legacy **Lead** path still treats prospects as first-class without requiring Signal.

---

## AUDIT 6 — Opportunity intelligence

| Field | Reality |
|-------|---------|
| ICP fit / score dimensions | Real rules engine |
| Confidence | Stored; model-dependent |
| Why Now / likely problem / outreach / next action | AI JSON when entitlements + provider configured |
| Recommended service/offer | AI constrained to org catalog |
| Recommended contact | Heuristic (+ soft AI) |
| Estimated value | Field exists; set via intel/updates |
| historicalConversion | **Placeholder** (~50) |

---

## AUDIT 7 — Sources

**Architecture:** Registry + adapters → normalized record → ingest (**Opportunity Engine not rewritten per source**). **Generic enough** for new adapters.

| Type | Reality |
|------|---------|
| CSV_CRM, website webhook | Strong |
| HubSpot/SF/Pipedrive/Meta/IG/LinkedIn | Real APIs **when credentials**; else payload/empty |
| Hiring/Funding/Web/RFP | **AI-generated** plausible signals — not live market APIs |

Dedup, org scope, source runs: present. Retry/rate-limit: partial (shared fetch + job patterns; not full per-provider quotas).

---

## AUDIT 8 — Email

| Capability | Verdict |
|------------|---------|
| Gmail/Outlook OAuth | Real |
| SMTP | Real outbound |
| Send + inbound sync | Real for OAuth accounts |
| Thread/conversation | Real inbox model |
| Reply classification | AI/heuristic present |
| Bounce/complaint | **Partial** (body heuristics) |
| Unsubscribe/suppression | Suppression table + classify; limited List-Unsubscribe |
| Daily limits / idempotency | Real (`email-safety`) |

**Inbox is REAL** when integrations are configured — not a mock UI-only module.

---

## AUDIT 9 — Campaigns + sequences

| Piece | Verdict |
|-------|---------|
| Campaign CRUD + lead follow-up engine | **Partial/near-complete** for leads |
| Reply/meeting/unsubscribe stop | Incomplete on job processor |
| OutreachSequence + steps | CRUD only |
| Enrollment / executor | **MISSING** |

---

## AUDIT 10 — CRM lifecycle

Opportunity → Meeting → Proposal → Deal → Revenue: **service-level COMPLETE** with stage side effects and `revenue` rows on win. UI is list/pipeline oriented; not all target detail routes exist. Agent does **not** fully drive this lifecycle (ack placeholders).

---

## AUDIT 11 — Billing

Stripe checkout, portal, subscription sync, idempotent webhooks, Free default, server entitlements on AI/email/opportunities/connectors/sequences/automation: **COMPLETE** when env configured.

Conceptual Free bypass via direct API: **largely prevented** at entitlement call sites; any new endpoint without `entitlementService` is a regression risk. Dual RBAC does not equal plan bypass.

---

## AUDIT 12 — AI

Operations include: opportunity intelligence, outreach generation, research (lead + opportunity), daily recommendations, learning patterns, connector AI discovery, agent INTERNAL_RECOMMENDATION / LEARN / research actions.

| Concern | Verdict |
|---------|---------|
| Provider | OpenAI/Anthropic via BYOK + `aiComplete` |
| Token/usage | `AIUsageLog` (+ entitlements) |
| Cross-org prompt data | Org-scoped services when used correctly |
| Untrusted external content | Wrap/sanitize present |
| Cost tracking | Usage logs; agent `maxDailySpend` **not enforced** |

---

## AUDIT 13 — Revenue Agent

| Control | Verdict |
|---------|---------|
| Goals / runs / actions tables | Real |
| Approval policy | Real defaults; limited mutability via API |
| Daily action limit | Enforced |
| Spending limit | Stored, **not enforced** |
| Idempotency | Real |
| Org isolation | Real on agent tables |
| Executable actions | Context, measure, run connector, score/research/recommend, create task, conditional send, learning, daily plan |
| Placeholder/ack | Draft outreach, prioritize, proposals, meetings, campaigns, sequences, create opp, etc. |

**UI completeness ≠ autonomous sales employee.**

---

## AUDIT 14 — Background jobs

Present: cron automation, follow_up_jobs, source runs, inbox sync APIs, billing webhook processing, job_logs, agent runs (request-driven).

Gaps: no dedicated worker fleet; `job_logs` without org; sequence executor absent; agent not a full scheduler.

---

## AUDIT 15 — Security

See **SECURITY_AUDIT.md**. Top issues: IDOR on notes/activities/research; dual RBAC; convention-based tenancy helpers unused.

---

## AUDIT 16 — Testing

~12 Vitest contract files (phases 2–13): billing, connectors, CRM, email, agent, security helpers, scope.

**Missing:** E2E, full IDOR suite, Stripe sandbox CI, OAuth email E2E, Playwright against production flows.

---

## AUDIT 17 — Performance (inspection only)

| Risk | Notes |
|------|-------|
| N+1 | Likely in list UIs with nested includes — not fully profiled |
| Unbounded lists | Some list endpoints may lack hard caps — verify per route before scale |
| Sync long requests | Connector run + AI research + agent runs inline in HTTP |
| Indexes | orgId present widely; search/pagination maturity uneven |
| Expensive AI | Intelligence + generative connectors on demand |

---

## AUDIT 18 — Legacy Leads

| Surface | Present |
|---------|---------|
| Pages | `/dashboard/leads`, new, `[id]`, edit |
| APIs | `/api/leads/**`, automation, campaigns discover, LinkedIn import |
| Tables | leads, lead_research, lead_scores, notes, activities, campaign_leads, conversations |
| Bridge | `Opportunity.leadId`, `Contact.leadId` |

**Future migration direction (not started):** Lead → Company + Contact + Signal + Opportunity; move automation onto opportunity/inbox sequences.

---

# Executive summary

### 1. What is genuinely production-ready?

- Multi-tenant org model with platform console separation  
- Business Brain / ICP / services / goals  
- Signal → Opportunity engine with scoring + intelligence (when AI/plan allows)  
- Org-scoped opportunities, deals, meetings, proposals, revenue  
- Real email OAuth inbox send/sync + suppressions  
- Stripe billing + server entitlements (with keys)  
- Dashboard analytics + learning hooks  
- Agent **framework** (goals/runs/approvals/idempotency) for a subset of real actions  
- Phase 13 hardening primitives (hashed sessions, rate limits, SSRF, CSP, cron fail-closed)

### 2. What only appears complete?

- **Revenue Agent** as full autonomous closer (many actions placeholder)  
- **Sequences** product (no enrollment)  
- **Advanced sources** as live market data (several are AI-synthetic)  
- **Org RBAC** as sole access control (legacy UserRole still gates APIs)  
- **Companies/Contacts** as product modules (data only)  
- Target IA routes (`/revenue`, `/inbox`, `/companies`, …)  
- Production readiness claims that imply all IDOR/RBAC gaps closed  

### 3. Biggest security risks?

1. Cross-tenant **notes / activities / AI research** IDOR  
2. **Dual permission systems** → UI/API mismatch (viewer/rep over-privilege via `UserRole`)  
3. Unscoped **job_logs** / optional AI usage orgId  
4. Reliance on “pass organizationId into service” without shared assert helpers on every route  

### 4. Biggest architecture problems?

1. **Dual CRM:** Leads automation vs Opportunities Revenue OS  
2. **Dual inbox:** `conversations` vs `inbox_conversations`  
3. **Dual authz:** org permissions vs legacy role permissions  
4. Overlapping automation: Campaigns, Autopilot, Sequences, Agent  

### 5. Biggest missing product functionality?

1. Companies & Contacts UI/API  
2. Sequence enrollment + runtime (reply/meeting/unsub stops)  
3. Agent actions that mutate CRM/outreach for real  
4. Notifications  
5. Honest labeling / replacement of AI-fake “market” sources  
6. E2E tenant-isolation & RBAC tests  

### 6. What must be fixed first?

1. **Security:** close IDOR + unify API authorization on org permissions  
2. **Product clarity:** freeze new lead features; define migration path to Opportunity model  
3. **Honesty layer:** mark placeholder agent actions & synthetic sources in UI/docs  
4. **Sequences:** implement or demote from entitlements/marketing  

### 7. Recommended implementation order (after approval only)

| Order | Workstream |
|------:|------------|
| 1 | Security hotfix: notes/activities/research org scope + requireOrgPermission migration for CRM/email/AI |
| 2 | RBAC single source of truth (map Viewer correctly; align User.role or stop using it for API authz) |
| 3 | Companies/Contacts read UI wired to existing models |
| 4 | Sequence enrollments + executor **or** remove feature flag/entitlement |
| 5 | Agent: enforce spend limit; implement or hide ack-only actions |
| 6 | Lead→Opportunity migration plan (data + automation cutover) |
| 7 | Route IA alignment (`/inbox`, `/deals`, settings split) if desired |
| 8 | E2E isolation + billing + email smoke tests |
| 9 | Source quality: replace or clearly label AI-synthetic connectors |

---

## STOP

Awaiting your approval before any fix, schema change, route change, or new phase.
