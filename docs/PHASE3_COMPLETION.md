# Phase 3 Completion Report — Opportunity Engine Core

**Status:** Complete — awaiting approval before Phase 4  
**Date:** 2026-09-03  
**Codebase:** `sales-platform`

---

## Summary

Job posts are **no longer the opportunity**. Discovery now creates:

**Company → Contact (+ legacy Lead bridge) → Hiring Signal → Opportunity (+ score)**

Leads remain for email automation / conversations (linked via `opportunity.lead_id` / `contact.lead_id`).

---

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Generalized Opportunity model | Done |
| Job post is a signal source (`HIRING` + source `job_post`) | Done |
| Companies extended (domain, funding, social, etc.) | Done |
| Contacts, Signals, Opportunities, Events, Scores | Done |
| Scoring stored in `opportunity_scores` | Done |
| UI `/opportunities` with filter views | Done |
| Opportunity detail: company, contacts, signals, score, why now, problem, service, action, timeline, linked conversations/tasks/meetings/proposals/deals | Done |

---

## Database changes

### Extended
- `companies` — domain (unique per org), state, employee_count/range, revenue_range, founded_year, social URLs, technologies, funding fields, status, source, metadata

### Added
- `contacts`
- `opportunity_sources`
- `signals`
- `opportunities`
- `opportunity_events`
- `opportunity_scores`

### Bridge
- `opportunities.lead_id` (optional unique) → legacy Lead
- `contacts.lead_id` (optional unique) → legacy Lead

---

## APIs

| Method | Path |
|--------|------|
| GET/POST | `/api/opportunities` |
| GET/PATCH | `/api/opportunities/[id]` |
| POST | `/api/opportunities/[id]/score` |

Job discovery (`JobDiscoveryService`) now returns `opportunityIds` and calls `opportunityService.ingestHiringSignal`.

---

## UI

| Path | Purpose |
|------|---------|
| `/dashboard/opportunities` | Filtered list (All/Hot/Warm/New/Needs Action/…) |
| `/dashboard/opportunities/[id]` | Detail + stage update |
| `/opportunities` | Redirect |

Sidebar: **Opportunities** in Main nav.

---

## Background jobs

No new cron. Autopilot/job discovery continues; each job-post prospect also produces a signal + opportunity.

---

## Tests completed

| Check | Result |
|-------|--------|
| `npm run typecheck` | Passed |
| `npm test` (15) | Passed |
| `npm run build` | Passed |

---

## Migration instructions

On production (with existing data):

```bash
cd /var/www/html/sales
git pull

# If Phase 1 org columns not applied yet:
npm run db:migrate:safe

# Otherwise Phase 3 is additive — push is usually enough:
npm run db:push

npm run build
pm2 restart sales
```

If `db push` complains about `companies` unique `(organization_id, domain)`, ensure domains are null or unique first (empty websites → null domain is fine in Postgres).

---

## Manual verification

1. Run job discovery / autopilot for an org with services + ICP configured.
2. Open **Opportunities** — new rows appear with scores; Hot/Warm filters work.
3. Open an opportunity — see company, hiring signal, why now, recommended action, score breakdown, events.
4. Confirm the job post title is on the **signal**, not treated as the opportunity name alone.
5. Legacy **Leads** still lists the linked lead for outreach automation.
6. Org B cannot open Org A opportunity IDs.

---

## Known issues

1. Conversations/tasks/meetings on the detail page are loaded via the linked **Lead** bridge (not yet first-class `opportunity_id` on those tables).
2. Scoring is rules-based (`rules_v1`), not ML embeddings.
3. Manual opportunity create API exists; list UI focuses on discovery-produced opps.
4. Apply schema on server before using the new pages.

---

## STOP

Phase 3 is complete. Do **not** start Phase 4 until explicitly approved.
