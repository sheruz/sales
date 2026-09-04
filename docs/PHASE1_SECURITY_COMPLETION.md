# Phase 1 Security Completion — Tenant Isolation & RBAC Hardening

**Status:** Complete — awaiting approval before next phase  
**Date:** 2026-09-04  
**Scope:** Security / authorization only (no product features)

---

## Chosen authorization pattern

```
requireUser / getCurrentUser
  → requireOrgPermission(perm) | requireAnyOrgPermission([...])
  → resource lookup: { id, organizationId }
```

- Customer APIs: **organization permission catalog only** (`organization_users.role` → permissions).
- Platform APIs: `requireSuperAdmin` only.
- **SUPER_ADMIN does not bypass** `hasOrgPermission` / `assertSameOrganization`.
- Helpers: `orgWhere`, `orgResourceWhere`, `assertSameOrganization` in `src/lib/tenant/scope.ts`.

---

## 1. Security fixes

| Issue | Fix |
|-------|-----|
| Notes IDOR | `organizationId` on Note; all queries/creates org-scoped; parent lead verified |
| Activities IDOR | `organizationId` on Activity; create/read org-scoped; parent lead/deal verified |
| AI research IDOR | `researchLead(organizationId, leadId)`; org RBAC; lead loaded with org filter |
| job_logs unscoped | `organizationId` + `isPlatformScoped`; tenant jobs require org; historical null → platform |
| AIUsageLog optional org | Tenant AI requires `organizationId`; `isPlatformScoped` for system-only; usage API filters by org |
| Dual RBAC on customer APIs | Migrated off `requirePermission` / `hasPermission` to `requireOrgPermission` |
| SUPER_ADMIN customer bypass | Removed from `hasOrgPermission` and `assertSameOrganization` |
| `/api/users` legacy authz | Org members use `users.*` perms; global list requires super admin |
| AI usage cross-user leak | `/api/ai/usage` scoped to `organizationId` (not only `userId`) |

---

## 2. Database changes

| Table | Change |
|-------|--------|
| `notes` | + `organization_id` NOT NULL, indexes, FK → organizations |
| `activities` | + `organization_id` NOT NULL, indexes, FK |
| `job_logs` | + `organization_id` nullable, + `is_platform_scoped`, index, FK |
| `ai_usage_logs` | + `is_platform_scoped`; null org ⇒ platform-scoped after backfill |

Migration script: `scripts/phase1-security-migrate.js`  
npm: `npm run db:migrate:security`

---

## 3. Authorization changes (customer APIs)

All former `requirePermission(...)` customer routes migrated, including:

leads notes/activities/tasks, campaigns, automation, autopilot, conversations, email-accounts, email-suppressions, deals, meetings, proposals, tasks, sequences, AI research/outreach/usage, ai-recommendations, learning, inbox sync, integrations/*, linkedin/*, users (org path).

**Mapping highlights:** campaigns/automation → `campaigns.manage`; deals read → `deals.manage|opportunities.view`; AI research → `leads.update|opportunities.update`; sequences → `sequences.manage`.

---

## 4. Files changed (primary)

- `prisma/schema.prisma`
- `scripts/phase1-security-migrate.js`
- `package.json` (`db:migrate:security`)
- `src/lib/auth/api-auth.ts`
- `src/lib/tenant/scope.ts`
- `src/lib/tenant/scope.test.ts`
- `src/lib/ai/provider.ts`, `src/lib/ai/usage.ts`
- `src/lib/jobs/runner.ts`
- `src/services/note.service.ts`, `activity.service.ts`, `ai-research.service.ts`
- `src/services/lead.service.ts`, `task.service.ts`, `automation.service.ts`, …
- `src/components/dashboard/app-sidebar.tsx` (no platform nav bypass)
- `src/app/api/**` (44+ routes + users)
- `src/lib/security/phase1-security.test.ts`

---

## 5. Tests added

`src/lib/security/phase1-security.test.ts` — 12 tests:

- Tenant helper contracts (`orgResourceWhere`, cross-org assert)
- SUPER_ADMIN no org-permission bypass
- Viewer / Rep / Manager / Admin matrix
- Conceptual IDOR + entitlement org scoping

Also updated `scope.test.ts` for no platform bypass.

**Suite:** 79 tests passing.

---

## 6. Existing functionality verified

- Typecheck clean after `prisma generate`
- Vitest full suite green
- Service signatures preserved with added `organizationId` args
- Lead notes/activities APIs still work for same-org callers
- AI research still callable with org + permission
- Platform routes still use `requireSuperAdmin`

---

## 7. Remaining legacy authorization

| Location | Why it remains |
|----------|----------------|
| `requirePermission` in `api-auth.ts` | Deprecated helper; **unused by API routes** after this phase |
| `User.role` / `hasPermission` in auth.service create/update user | Actor capability for elevating legacy enum roles; org gate is now on routes |
| Task list filters by `UserRole.SALES_REPRESENTATIVE` | Ownership UX heuristic (not authz gate) |
| Settings nav `hasPermission(user.role, "settings:read")` | UI only; APIs use org permissions |

**No customer API route handlers use `requirePermission` or `hasPermission` after this phase.**

---

## 8. Remaining security risks

| Risk | Severity | Notes |
|------|----------|-------|
| Production DB must run migrate script before deploy | Critical | Schema required columns |
| Dual CRM Leads still large surface | Medium | Out of scope; now org-scoped |
| Rep still has `integrations.manage` in catalog | Low | Explicit product permission |
| No live E2E HTTP IDOR tests against DB | Medium | Unit/contracts only |
| authService updateUser still global by user id after membership check | Low | Membership asserted first on route |
| Secrets in error messages | Low | usage metadata sanitized; continue audit on new logs |

---

## 9. Migration commands

**Do not recommend `prisma db push` for production after this script.**

Current repo has **no** `prisma/migrations` history; live schema has been evolved via controlled scripts (`db:migrate:safe`, etc.). For Phase 1 security columns, the authoritative apply path is:

```bash
# Staging / approved production DB only:
npm run db:migrate:security

# App build machines (no schema mutate required if migrate already applied):
npm run db:generate
npm run test
npm run typecheck
```

### Migration safety (revised)

- **Never deletes** notes/activities (or any other) rows
- Backfills `organization_id` from parent lead/deal
- **Aborts** if any note/activity remains NULL after backfill (prints sample IDs)
- Sets `NOT NULL` only when unresolved count is **zero**
- `job_logs`: backfill org from validated metadata / follow_up_jobs / source_runs; platform-scoped **only** for allow-listed job types; unknown history stays **unclassified** (`organization_id NULL`, `is_platform_scoped false`)
- Idempotent indexes/FKs; transactional backfill + NOT NULL
- Post checks: zero nulls, valid org FKs, indexes/FKs present, classification valid, row counts unchanged

### Prisma migration required?

Not as `migrate deploy` yet — there is no migration baseline. A future workstream can baseline Prisma Migrate; until then **this script** is the controlled production migration for these columns. Do **not** blindly `db push` afterward.

---

## 10. Verification checklist

1. On staging: `npm run db:migrate:security` succeeds (or aborts with unresolved IDs — then fix data and re-run).  
2. `npm run db:generate && npm run test && npm run typecheck`  
3. Login as **Viewer** → `POST /api/campaigns` → 403  
4. Org A → Org B notes/research → 404 / no cross-tenant data  
5. Confirm notes/activities still create for same-org lead  
6. Spot-check APIs never return OAuth tokens / API keys  

---

## STOP

Awaiting approval before any further phase.
