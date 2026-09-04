# Phase 12 Completion Report — Autonomous AI Revenue Agent

**Status:** Complete — awaiting approval before next phase  
**Date:** 2026-09-04  
**Codebase:** `sales-platform`

---

## Summary

Moved from “AI assistant” to a **controlled autonomous revenue agent** that operates only against an **approved (ACTIVE) Revenue Goal**. Every action is authorized by policy, org-scoped, idempotent, logged, and subject to daily limits. The agent **cannot** perform unrestricted actions.

---

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Agent goal bound to Revenue Goal | Done |
| Agent runs + actions with audit trail | Done |
| Approval required for campaign / sequence / outbound / proposal / price / unusual volume / new provider / expensive AI | Done |
| Auto-allow research / scoring / classification / summarization / prioritization / tasks / internal recommendations | Done |
| Actions authorized, logged, org-scoped, idempotent, auditable, limited | Done |

---

## Data model

- `agent_goals` — objective, constraints, channels, allowed actions, approval policy, daily limits
- `agent_runs` — status, counts, summary, unique `(organization_id, idempotency_key)`
- `agent_actions` — type, input/result, approval fields, unique `(organization_id, idempotency_key)`

---

## Policy (initial)

**Auto:** `READ_CONTEXT`, `SCORE_OPPORTUNITY`, `RESEARCH_OPPORTUNITY`, `PRIORITIZE`, `CREATE_TASK`, `INTERNAL_RECOMMENDATION`, `CLASSIFY`, `SUMMARIZE`, `DRAFT_OUTREACH`, `LEARN`, …

**Require approval:** `CREATE_CAMPAIGN`, `CREATE_SEQUENCE`, `SEND_OUTREACH`, `SEND_PROPOSAL`, `CHANGE_PRICE`, `RUN_SOURCE_CONNECTOR`, `ENABLE_DATA_PROVIDER`, `EXPENSIVE_AI`, `UNUSUAL_VOLUME`, …

Unknown actions **fail closed** (require approval). Actions outside `allowed_actions` are **DENIED**.

---

## Runtime

1. ACTIVE agent goal + ACTIVE revenue goal required  
2. Daily action budget enforced  
3. Plan steps → enqueue (idempotent) → auto-execute or park  
4. Human approve/deny → execute via existing services (Opportunity Engine, sources, inbox, tasks, learning)  
5. No Opportunity Engine rewrite

---

## APIs / UI

| Path | Purpose |
|------|---------|
| `GET/POST /api/agent/goals` | List / create |
| `GET/PATCH /api/agent/goals/[id]` | Detail / activate / pause |
| `GET/POST /api/agent/runs` | History / start run |
| `GET /api/agent/runs/[id]` | Run + actions |
| `GET/POST /api/agent/approvals` | Pending / approve|deny |
| `/dashboard/agent` | Agent console (also `/dashboard/assistant` → redirect) |

Permissions: `agent.view`, `agent.manage`, `agent.approve` (re-seed RBAC on deploy).

---

## Deploy notes

1. `npm run db:generate` && `npm run db:push`
2. Restart app (permissions seed on org ensure / login path)
3. Activate a Revenue Goal → create Agent Goal → Run once → approve parked actions

---

## Verification

- Phase 12 policy tests
- `npm run typecheck` / `npm test` / `npm run build`

---

**STOP.** Do not start the next phase without approval.
