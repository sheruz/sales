# Phase 4 Completion Report — Multi-Source Opportunity Connector Framework

**Status:** Complete — awaiting approval before Phase 5  
**Date:** 2026-09-03  
**Codebase:** `sales-platform`

---

## Summary

The Opportunity Engine is now **provider-independent**. All sources produce the same `NormalizedSignalRecord` shape; ingestion goes through `opportunityService.ingestNormalizedSignal` with deduplication.

Job discovery was migrated onto the **Hiring Signal Connector**.

---

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Provider-independent connector framework | Done |
| `source_connectors` + `source_runs` | Done |
| Interface: connect/validate/fetch/normalize (+ disconnect hooks) | Done |
| Hiring Signal Connector (company, job, URL, title, tech, location, date, description, confidence) | Done |
| Funding / Web research / RFP-Tender / CSV-CRM connectors | Done |
| Dedup: org, domain, name, email, external ID, fingerprint | Done |
| Engine does not care about job board vs funding vs CSV vs CRM | Done |

---

## Architecture

```
SourceConnectorAdapter (HIRING | FUNDING | WEB_RESEARCH | RFP_TENDER | CSV_CRM)
        ↓ fetch + normalize
NormalizedSignalRecord
        ↓ dedupe
opportunityService.ingestNormalizedSignal
        ↓
Company + Contact + Signal + Opportunity + Score
```

---

## Database changes

| Table | Purpose |
|-------|---------|
| `source_connectors` | Org-configured connectors (type, provider, encrypted credentials, config, status) |
| `source_runs` | Sync run metrics (found/created/updated/failed/skipped) |
| `signals` (extended) | `source_connector_id`, `source_run_id`, `fingerprint`, `external_id` |

Unique: `(organization_id, fingerprint)` for signal dedupe.

---

## APIs / UI

| Path | Purpose |
|------|---------|
| `GET/POST /api/source-connectors` | List/create |
| `GET/PATCH /api/source-connectors/[id]` | Detail/update |
| `POST /api/source-connectors/[id]/run` | Execute fetch→normalize→ingest |
| `GET /api/source-connectors/runs` | Run history |
| `/dashboard/sources` (+ `/sources`) | Manage & run connectors |

---

## Files (high level)

- `src/lib/connectors/types.ts`, `dedupe.ts`, `registry.ts`
- `src/lib/connectors/adapters/{hiring,funding,web-research,rfp-tender,csv-crm}.ts`
- `src/services/source-connector.service.ts`
- `src/services/opportunity.service.ts` — `ingestNormalizedSignal`
- `src/services/job-discovery.service.ts` — uses Hiring connector + source runs
- `src/app/api/source-connectors/**`
- `src/app/dashboard/sources/**`

---

## Tests completed

| Check | Result |
|-------|--------|
| `npm run typecheck` | Passed |
| `npm test` (20) | Passed |
| `npm run build` | Passed |

---

## Migration

```bash
cd /var/www/html/sales
git pull
npm run db:push          # additive tables/columns
npm run build
pm2 restart sales
```

If Phase 1 org columns were never applied, use `npm run db:migrate:safe` first.

---

## Manual verification

1. Open **Sources** → create Hiring connector → Run → Opportunities appear from hiring signals.
2. Create CSV connector → paste CSV with `company_name,email,signal_title` → Run → CRM_ACTIVITY signals.
3. Funding / Web Research → Run (needs AI key) → normalized signals, not provider-specific tables.
4. RFP requires `complianceAcknowledged` before run.
5. Re-run same hiring signal → skipped via fingerprint dedupe.
6. Autopilot/job discovery still works and writes `source_runs`.

---

## Known issues

1. AI-based connectors (hiring/funding/web/RFP) synthesize from model knowledge — not live board scrapes; treat as assistive discovery.
2. RFP connector requires explicit compliance acknowledgment; no paywalled portal scraping.
3. Credentials encryption requires `ENCRYPTION_KEY` when storing API keys on connectors.
4. Conversations still bridge via Lead for hiring path with email.

---

## STOP

Phase 4 is complete. Do **not** start Phase 5 until explicitly approved.
