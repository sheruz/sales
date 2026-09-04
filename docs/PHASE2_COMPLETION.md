# Phase 2 — Completion Report

**Status:** Implementation complete — awaiting approval  
**Do not start Phase 3 until approved.**

## Summary

Revenue OS (Company → Contact → Signal → Opportunity → …) is the canonical CRM path. Lead remains a legacy compatibility layer with an idempotent, non-destructive bridge. First-class Company/Contact APIs and dashboard UI are in place. Opportunities do not require Lead.

## Database

| Change | Detail |
|--------|--------|
| Columns | `companies.normalized_domain`, `contacts.normalized_email` (nullable) |
| Indexes | `(organization_id, normalized_domain)`; `(organization_id, normalized_email)`; `(organization_id, company_id, normalized_email)` |
| Unique on normalized_domain | **Not** applied automatically — migrate script **reports** duplicate groups |
| Migration | `npm run db:migrate:crm` → `scripts/phase2-crm-migrate.js` |
| Data deleted | **None** (script aborts if row counts change) |
| Production | Do **not** run until approved; no `db push` |

## APIs

| Method | Path |
|--------|------|
| GET/POST | `/api/companies` |
| GET/PATCH | `/api/companies/[id]` |
| GET/POST | `/api/contacts` |
| GET/PATCH | `/api/contacts/[id]` |
| POST | `/api/leads/[id]/bridge` (on-demand bridge) |

Auth: `requireAnyOrgPermission` with existing `leads.*` / `opportunities.*` keys. Client `organizationId` ignored.

## UI

- `/dashboard/companies`, `/dashboard/companies/[id]`
- `/dashboard/contacts`, `/dashboard/contacts/[id]`
- Sidebar: Companies, Contacts (before Pipeline / Leads)

## Compatibility

- `src/services/lead-migration.service.ts` — org-scoped, idempotent
- Campaigns/autopilot unchanged (still Lead-centric)
- Legacy `Conversation` + inbox unchanged

## Docs

- `docs/PHASE2_CRM_ARCHITECTURE.md`
- `docs/ARCHITECTURE_RULES.md`

## Remaining (Phase 3+)

- Campaign enrollment on Opportunity/Contact
- Automation without required Lead
- Conversation history consolidation
- Bulk lead bridge / duplicate company merge tooling
- Optional unique `(organization_id, normalized_domain)` after dedupe
- Lead retirement path

**STOP — wait for approval.**
