# FEATURE GAP MATRIX

**Date:** 2026-09-04  
**Method:** Code + schema + API + UI inspection (not prior “Done” docs)  
**Audit only**

Status values: **COMPLETE** · **PARTIAL** · **PLACEHOLDER** · **BROKEN** · **MISSING** · **LEGACY** · **SECURITY RISK**

Priority: **Critical** · **High** · **Medium** · **Low**

---

## Core revenue chain

| Feature | Status | Priority | Evidence / gap |
|---------|--------|----------|----------------|
| Business Brain (profile/docs/versions) | COMPLETE | — | APIs + UI `/dashboard/business-brain` |
| Services + case studies + offers | PARTIAL | Medium | CRUD APIs/UI; weak `:id` UX |
| ICP | COMPLETE | — | `/dashboard/icp` + APIs |
| Revenue Goals | PARTIAL | Medium | List/CRUD; no rich forecast UI |
| Sources / connectors framework | PARTIAL | High | Generic normalize→ingest OK; many adapters AI-synthetic or credential-gated |
| Signals (distinct from opportunities) | COMPLETE | — | `Signal` + fingerprint dedupe + company attach |
| Companies | PARTIAL | High | Schema+service used; **no companies UI/API surface** |
| Contacts | PARTIAL | High | Schema+ingest; **no contacts UI/API** |
| Opportunities | COMPLETE | — | Full service + UI + stages |
| Opportunity scoring | PARTIAL | Medium | Rules engine real; `historicalConversion` hardcoded ~50 |
| Opportunity intelligence (why now, service, offer, contact, action) | PARTIAL | Medium | Real AI when entitled; else empty/cached; needs ADVANCED_AI |
| Recommended service/offer persistence | COMPLETE | — | Fields + `OpportunityIntelligence` |
| Outreach (inbox send) | COMPLETE | High* | Real Gmail/Outlook/SMTP when configured |
| Conversations / inbox sync | COMPLETE | High* | Real sync; bounce heuristic only |
| Campaigns (lead automation) | PARTIAL | High | Works on **leads**; reply-stop incomplete on follow-ups |
| Sequences (product model) | PLACEHOLDER | High | CRUD steps only; **no enrollments/executor** |
| Meetings | PARTIAL | Medium | API+list UI; advances opp stage; limited detail UX |
| Proposals | PARTIAL | Medium | API+list; versions exist; limited UX |
| Deals / pipeline | COMPLETE | — | `/dashboard/pipeline` + deal service + revenue on win |
| Revenue recognition | COMPLETE | — | `revenue` table on win |
| Analytics | PARTIAL | Medium | On Dashboard; no `/revenue/*` IA; API gated |
| Learning | PARTIAL | Medium | Pattern discovery; Free plan may disable; recommend not auto-apply |
| Revenue Agent | PARTIAL | High | UI+runs real; many actions ack/deferred; spend limit unused |
| Daily Revenue Copilot | PARTIAL | Low | Component on dashboard; recommendations API |

\*Env/credential dependent in production.

---

## SaaS platform capabilities

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Multi-tenancy (organizations) | COMPLETE | — | orgId on core tables |
| Org RBAC seed + memberships | PARTIAL | **Critical** | Dual with legacy UserRole |
| Super Admin platform app | COMPLETE | — | `/platform` isolated |
| Invites / team management | COMPLETE | — | |
| Signup + default Free plan | COMPLETE | — | |
| Stripe checkout/portal/webhooks | COMPLETE | High* | Keys required for paid |
| Entitlement enforcement | COMPLETE | — | Server-side on major meters |
| Usage metering | COMPLETE | — | `usage_records` |
| Privacy export/delete | PARTIAL | Medium | API present; UX discoverability |
| Notifications | MISSING | Medium | No table/UI |
| In-app health for platform | MISSING | Low | API only |

---

## Security / compliance features

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Hashed sessions | COMPLETE | — | |
| Rate limit / lockout | COMPLETE | — | |
| CSP / security headers | COMPLETE | — | |
| SSRF guard | COMPLETE | — | |
| Tenant isolation (core CRM) | PARTIAL | **Critical** | Notes/activities/AI research IDOR |
| Org permission on all APIs | SECURITY RISK | **Critical** | Legacy gates dominate CRM/email |
| Email suppression | COMPLETE | — | |
| Bounce/complaint | PARTIAL | Medium | Heuristic, not ESP webhooks |
| Audit logs coverage | PARTIAL | High | Incomplete for agent/admin |
| Untrusted AI content wrap | COMPLETE | — | |

---

## Integrations

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Gmail OAuth send/sync | COMPLETE | — | Config-gated |
| Outlook OAuth send/sync | COMPLETE | — | Config-gated |
| SMTP | COMPLETE | — | Outbound |
| LinkedIn (legacy discover + connector) | PARTIAL | Medium | Dual paths; API often needs tokens |
| Meta / Instagram connectors | PARTIAL | Medium | Graph or payload |
| HubSpot / Salesforce / Pipedrive | PARTIAL | Medium | API or CSV export |
| Website visitors webhook | COMPLETE | — | Push ingest |
| Hiring/Funding/Web/RFP connectors | PARTIAL | High | **AI-generated signals**, not live boards |
| OpenAI / Anthropic BYOK | COMPLETE | — | |

---

## Background jobs

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Cron automation | PARTIAL | High | Follow-ups + connector runs; secret-gated prod |
| Follow-up job retries/DLQ | PARTIAL | Medium | Retries exist; reply-stop gaps |
| Job logs | PARTIAL | High | **No organizationId** |
| Agent scheduled runs | PARTIAL | Medium | On-demand API; not rich scheduler |
| Inbox sync job | PARTIAL | Medium | API-triggered sync |
| Unified queue/workers | MISSING | Medium | No separate worker process |

---

## Testing

| Area | Status | Priority | Notes |
|------|--------|----------|-------|
| Unit/contract tests (phases 2–13) | PARTIAL | High | ~12 test files; logic-focused |
| E2E browser tests | MISSING | High | None found |
| Live IDOR / multi-tenant E2E | MISSING | **Critical** | Isolation script may exist; not full suite |
| Billing/Stripe integration tests | PARTIAL | Medium | Phase10 unit-style |
| Email provider integration tests | PARTIAL | Medium | Phase6 contracts |

---

## Legacy

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Leads CRM (pages+APIs+automation) | LEGACY | **Critical** (product clarity) | Still primary for campaigns/automation |
| Lead-tied `conversations` table | LEGACY | High | Parallel to inbox |
| LinkedIn discovery jobs | LEGACY | Medium | Overlaps connectors |
| Root redirect pages | COMPLETE | Low | Harmless |

---

## Target IA gaps (routes)

| Target area | Status | Priority |
|-------------|--------|----------|
| `/companies`, `/contacts` | MISSING | High |
| `/revenue/*` | MISSING | Medium |
| `/sequences` UI | MISSING | High |
| `/inbox` naming | PARTIAL | Low |
| Split `/settings/*` | PARTIAL | Low |
| `/platform/health` UI | MISSING | Low |

---

## Ranking — fix first (recommendation only)

1. **Critical:** IDOR on notes/activities/AI research + unify RBAC  
2. **Critical:** Decide Leads vs Opportunities product path (stop dual-brain UX)  
3. **High:** Sequence enrollment runtime OR remove from product claims  
4. **High:** Companies/Contacts first-class UI  
5. **High:** Agent action honesty (disable ack-only or implement)  
6. **Medium:** Live data sources vs AI-synthetic labeling in UI  
7. **Medium:** Bounce webhooks, notifications, E2E isolation tests  

---

## STOP

No implementation. Await approval.
