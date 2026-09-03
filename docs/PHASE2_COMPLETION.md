# Phase 2 Completion Report — Business Brain + Services + ICP + Revenue Goals

**Status:** Complete — awaiting approval before Phase 3  
**Date:** 2026-09-03  
**Codebase:** `sales-platform`

---

## Summary

Customers can now define **who they are**, **what they sell**, **who they want**, and **how much revenue they want**. AI can retrieve a **safe, org-scoped context** (`GET /api/business-brain/context`) with concise business facts only (no private chain-of-thought).

Existing `services` table was **extended** (not duplicated).

---

## Files changed (high level)

### Schema
- `prisma/schema.prisma` — `BusinessProfile`, `BusinessBrainDocument`, `BusinessBrainVersion`, `Icp`, `RevenueGoal`, `ServiceCaseStudy`; Service extended with category/pricing/currency/idealCustomer/problemsSolved/status

### Services
- `src/services/business-brain.service.ts`
- `src/services/icp.service.ts`
- `src/services/revenue-goal.service.ts` (incl. AI goal parse)
- `src/services/service-catalog.service.ts` (extended fields + case studies)

### APIs
- `/api/business-brain/profile`
- `/api/business-brain/documents` (+ `[id]`)
- `/api/business-brain/context` — safe AI retrieval
- `/api/icps` (+ `[id]`)
- `/api/revenue-goals` (+ `[id]`, `/parse`)
- `/api/services` (+ `[id]`) — uses `business_brain.manage`

### UI
- `/dashboard/business-brain`, `/dashboard/services`, `/dashboard/icp`, `/dashboard/revenue-goals`
- Redirects: `/business-brain`, `/services`, `/icp`, `/revenue-goals`
- Sidebar **Revenue OS** group
- Settings → link to full services catalog

### Auth
- `permission-catalog.ts` — sales_manager gets `business_brain.manage`, `revenue_goals.manage`, `revenue.view`; viewer/rep get `revenue.view`

### Tests
- `src/lib/business-brain/phase2.test.ts`

### Docs
- `docs/PHASE2_COMPLETION.md` (this file)

---

## Database changes

| Table | Notes |
|-------|--------|
| `business_profiles` | One per organization (`organization_id` unique) |
| `business_brain_documents` | Typed knowledge docs |
| `business_brain_versions` | Versioned content + `generated_summary` |
| `icps` | Multiple ICPs per org |
| `revenue_goals` | Goals + `strategy_draft` JSON + `source_prompt` |
| `service_case_studies` | Structured case studies linked to existing `services` |
| `services` | New columns: category, pricing_model, currency, ideal_customer, problems_solved, status (keeps min_budget/max_budget/typical_timeline/is_active) |

---

## APIs added/changed

| Method | Path | Purpose |
|--------|------|---------|
| GET/PUT | `/api/business-brain/profile` | Org business profile |
| GET/POST | `/api/business-brain/documents` | Brain docs |
| PATCH/DELETE | `/api/business-brain/documents/[id]` | Update/version/delete |
| GET | `/api/business-brain/context` | Safe AI context |
| GET/POST | `/api/icps` | ICP CRUD list/create |
| GET/PATCH/DELETE | `/api/icps/[id]` | ICP update/deactivate |
| GET/POST | `/api/revenue-goals` | Goals |
| GET/PATCH/DELETE | `/api/revenue-goals/[id]` | Goal update/cancel |
| POST | `/api/revenue-goals/parse` | AI parse → edit → create draft/activate |
| GET/POST/PATCH/DELETE | `/api/services` | Extended service catalog |

All tenant queries are **organization-scoped** with `requireOrgPermission` / `requireOrganizationContext`.

---

## UI pages added/changed

| Path | Purpose |
|------|---------|
| `/dashboard/business-brain` (+ `/business-brain`) | Profile + documents |
| `/dashboard/services` (+ `/services`) | Full service catalog |
| `/dashboard/icp` (+ `/icp`) | Multiple ICPs |
| `/dashboard/revenue-goals` (+ `/revenue-goals`) | Manual + AI-parsed goals |

---

## Background jobs

None added. AI parse runs synchronously via existing BYOK `aiComplete`.

---

## Tests completed

| Check | Result |
|-------|--------|
| `npm run typecheck` | Passed |
| `npm test` (13 tests) | Passed |
| `npm run build` | Passed |

---

## Known issues

1. **Schema must be applied** on each environment (`npm run db:push` or migrate) before using new pages.
2. **AI goal parse** requires a connected OpenAI/Anthropic key (BYOK); without it, parse fails with a clear error.
3. **Re-seed RBAC** recommended after deploy so sales_manager gains new permission keys: run `phase1-backfill` or `db:seed` (idempotent role permission upsert).
4. Case study UI create API exists on service layer; dedicated case-study UI controls are minimal (API ready via service catalog methods — can deepen in a later polish).
5. Local Postgres may still fail auth on this workstation; apply schema on the production/server DB.

---

## Migration instructions

```bash
cd /var/www/html/sales   # or local project root

# Production DB with existing leads/campaigns (keeps data):
npm run db:migrate:safe

# Fresh empty DB only:
# npm run db:push && npm run db:seed

npm run build
pm2 restart sales
```

`db:migrate:safe` preserves existing rows. **Never** use `db push --force-reset` on production.

---

## Manual verification steps

1. Login as Company Admin → sidebar **Revenue OS** appears.
2. **Business Brain** — fill company profile, save; add a FAQ/document; confirm list.
3. **Services** — create a service with category, pricing, problems solved; appears in list; Settings quick-add still works.
4. **ICP** — create two ICPs with different industries/countries; deactivate one.
5. **Revenue Goals** — paste:  
   `I want $100k in new software development revenue this quarter from US startups.`  
   → Parse → edit fields → Save draft (optionally create ICP) → Activate.
6. Call `GET /api/business-brain/context` authenticated — returns profile/services/icps/goals/document summaries only (no raw reasoning).
7. As Org B user, confirm Org A profile/ICPs/goals are not returned (tenant isolation).

---

## STOP

Phase 2 is complete. Do **not** start Phase 3 until explicitly approved.
