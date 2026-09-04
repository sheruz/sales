# Phase 7 Completion Report — CRM Pipeline + Meetings + Proposals + Deals + Revenue

**Status:** Complete — awaiting approval before Phase 8  
**Date:** 2026-09-03  
**Codebase:** `sales-platform`

---

## Summary

A prospect can now move **Opportunity → Contacted → Reply → Meeting → Proposal → Negotiation → Won → Revenue** entirely inside the platform. Existing Task / Meeting / Proposal / Deal tables were extended onto Opportunity; a new `revenue` recognition table closes the loop when a deal is won.

---

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Tasks with org, assignee, opportunity/company/contact, type, due, completed | Done |
| Meetings with opportunity/company/contact, start/end, timezone, location, URL, status/notes | Done |
| Proposals with money fields, version, sent/viewed/accepted/expires | Done |
| Deals with opportunity, primary contact, stages incl. discovery, won/lost reasons | Done |
| Revenue recognition on win | Done |
| Full journey without leaving the platform | Done (Pipeline board + Opportunity CRM actions) |

---

## Journey

```
Opportunity (NEW/QUALIFIED)
  → CONTACTED / REPLIED
  → DISCOVERY / MEETING   (book meeting)
  → PROPOSAL              (create/send proposal)
  → NEGOTIATION           (proposal accepted)
  → WON                   (deal synced + revenue row)
  → Revenue (`revenue` table)
```

---

## Database (extensions)

| Table | Changes |
|-------|---------|
| `tasks` | `type`, `completed_at`, `opportunity_id`, `company_id`, `contact_id` |
| `meetings` | `opportunity_id`, `company_id`, `contact_id`, `description`, `end_at`, `timezone`, `location`, `notes`; `lead_id` optional |
| `proposals` | opportunity/company/contact, subtotal/discount/content/version, lifecycle timestamps; statuses VIEWED/EXPIRED |
| `deals` | `opportunity_id`, `primary_contact_id`, `actual_close_date`, `won_reason`; `lead_id` optional; stage `DISCOVERY` |
| `revenue` | **new** — deal recognition entries |
| Opportunity/Deal stages | added `DISCOVERY` |

---

## APIs / UI

| Path | Purpose |
|------|---------|
| `GET/POST /api/deals` (+ `?board=1`) | Deals + opportunity Kanban |
| `PATCH /api/deals/[id]` | Stage changes (+ revenue on WON) |
| `GET/POST /api/meetings` | Meetings CRUD |
| `GET/POST /api/proposals` | Proposals CRUD |
| `PATCH /api/proposals/[id]` | Status (SENT → advances opportunity) |
| `GET/POST /api/tasks` | Tasks (opportunity-aware) |
| `/dashboard/pipeline` | Kanban board |
| `/dashboard/meetings` | Meeting list |
| `/dashboard/proposals` | Proposal list |
| Opportunity detail | Book meeting / create proposal / task / mark won |

---

## Deploy notes

1. `npm run db:generate`
2. `npm run db:push` (makes `lead_id` optional on meetings/proposals/deals; adds columns)
3. Restart app

---

## Verification

- Phase 7 unit tests for stage mapping / probability
- `npm run typecheck` / `npm test` / `npm run build`

---

**STOP.** Do not start Phase 8 without approval.
