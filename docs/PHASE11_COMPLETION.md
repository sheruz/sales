# Phase 11 Completion Report — Advanced Opportunity Sources

**Status:** Complete — awaiting approval before next phase  
**Date:** 2026-09-04  
**Codebase:** `sales-platform`

---

## Summary

Expanded opportunity sources beyond hiring using the **existing Phase 4 connector framework**. New adapters feed **`NormalizedSignalRecord` → signals** only — **no Opportunity Engine rewrite**.

Foundation rule: **official APIs / licensed providers / customer-provided data / legally permitted sources**. Scraping is not a fallback.

---

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| LinkedIn (official/licensed/customer) | Done |
| Meta / Facebook (Graph API) | Done |
| Instagram (Business Graph API) | Done |
| Website visitors (pixel/webhook / licensed reveal) | Done |
| HubSpot / Salesforce / Pipedrive | Done |
| All sources feed **signals** (not proprietary opportunity models) | Done |
| New connectors require **no rewrite** of Opportunity Engine | Done |

---

## Architecture (unchanged engine)

```
SourceConnectorAdapter (Phase 4 + Phase 11 types)
        ↓ fetch + normalize
NormalizedSignalRecord
        ↓
opportunityService.ingestNormalizedSignal
        ↓
Company + Contact + Signal + Opportunity + Score
```

---

## New `SourceConnectorType` values

`LINKEDIN` · `META` · `INSTAGRAM` · `WEBSITE_VISITORS` · `HUBSPOT` · `SALESFORCE` · `PIPEDRIVE`

Signal types used: `SOCIAL_ACTIVITY`, `LEADERSHIP_CHANGE`, `WEBSITE_VISIT`, `CRM_ACTIVITY`.

---

## Adapters

| Type | Provider | Permitted modes |
|------|----------|-----------------|
| LINKEDIN | `linkedin_official` | OAuth/API token + org URN, or `params.records` |
| META | `meta_graph` | Graph page posts, or `params.records` |
| INSTAGRAM | `instagram_graph` | IG business media, or `params.records` |
| WEBSITE_VISITORS | `visitor_webhook` | Webhook ingest / `params.events` |
| HUBSPOT | `hubspot` | Private app token, or export records |
| SALESFORCE | `salesforce` | REST + instance URL, or export records |
| PIPEDRIVE | `pipedrive` | API token, or export records |

When official API access is missing or denied, adapters return empty results with metadata — **they do not scrape**.

---

## APIs

| Path | Purpose |
|------|---------|
| Existing `/api/source-connectors*` | Create/run advanced types from catalog |
| `POST /api/webhooks/website-visitors` | First-party/licensed visitor events (`x-webhook-secret`) |

Run body also accepts `records`, `licensedPayload`, `events`.

---

## Deploy notes

1. `npm run db:generate`
2. `npm run db:push` (enum extension on `source_connectors.type`)
3. Restart app
4. Create connectors under **Sources**; store API tokens in connector credentials
5. For visitors: set `webhookSecret` on the connector, POST events to `/api/webhooks/website-visitors`

---

## Verification

- Phase 11 contract tests
- `npm run typecheck` / `npm test` / `npm run build`

---

**STOP.** Do not start the next phase without approval.
