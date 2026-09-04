# DATABASE AUDIT

**Date:** 2026-09-04  
**Source of truth:** `prisma/schema.prisma` (ORM) — not live DB introspection  
**Scope:** Audit only — no schema changes recommended as actions in this document (disposition only)

---

## Summary

The schema is a **hybrid**: a mature multi-tenant Revenue OS (signals → opportunities → CRM → billing → agent) coexists with a **legacy Leads CRM** and several tables that lack `organizationId` (notes, activities, job_logs).

**Missing vs product checklist:** `notifications`, `sequence_enrollments`, generic `webhook_events` / `background_jobs` (partially covered by other tables).

---

## Entity inventory

| Entity (requested / actual) | Exists | Columns Complete* | organizationId | Relations | Used in code | Status / disposition |
| --------------------------- | ------ | ----------------- | -------------- | --------- | ------------ | -------------------- |
| organizations | Yes | Yes | N/A (tenant root) | Users, settings, all tenant data | Yes | **Remain** |
| users | Yes | Yes (+ legacy `UserRole`) | No (global identity) | sessions, memberships | Yes | **Remain** |
| organization_users | Yes | Yes | Yes | org, user, role | Yes | **Remain** |
| roles | Yes | Yes | No (system roles) | role_permissions, memberships | Yes | **Remain** |
| permissions | Yes | Yes | No | role_permissions | Yes | **Remain** |
| role_permissions | Yes | Yes | No | role, permission | Yes | **Remain** |
| organization_settings | Yes | Partial (few fields) | Yes (PK) | org | Yes | **Remain** |
| organization_invitations | Yes | Yes | Yes | org, role | Yes | **Remain** |
| business_profiles | Yes | Yes | Yes (unique) | org | Yes | **Remain** |
| business_brain_documents | Yes | Yes | Yes | org | Yes | **Remain** |
| business_brain_versions | Yes | Yes | Via document | document | Yes | **Remain** |
| services | Yes | Yes | Yes | offers, case studies, opps | Yes | **Remain** |
| service_case_studies | Yes | Yes | Yes | service | Yes | **Remain** |
| offers | Yes | Yes | Yes | service, opps | Yes | **Remain** |
| icps | Yes | Yes | Yes | org | Yes | **Remain** |
| revenue_goals | Yes | Yes | Yes | org | Yes | **Remain** |
| companies | Yes | Yes | Yes | contacts, signals, opps | Yes | **Remain** |
| contacts | Yes | Yes | Yes | company, opps, optional lead | Yes | **Remain** (no dedicated UI/API) |
| source_connectors | Yes | Yes | Yes | runs, signals | Yes | **Remain** |
| source_runs | Yes | Yes | Yes | connector | Yes | **Remain** |
| opportunity_sources | Yes | Yes | Yes | signals, opps | Yes | **Remain** (catalog keys) |
| signals | Yes | Yes (+ fingerprint) | Yes | company, connector, opps | Yes | **Remain** |
| opportunities | Yes | Yes (intel fields inline) | Yes | company, signal, lead bridge | Yes | **Remain** |
| opportunity_scores | Yes | Yes | Yes | opportunity | Yes | **Remain** |
| opportunity_events | Yes | Yes | Yes | opportunity | Yes | **Remain** |
| opportunity_intelligences | Yes | Yes | Yes | opportunity | Yes | **Remain** |
| opportunity_offer_recommendations | Yes | Yes | Yes | opportunity, offer | Yes | **Remain** |
| campaigns | Yes | Yes | Yes | leads, follow-ups | Yes | **Remain** (lead-centric) |
| outreach_sequences | Yes | Yes | Yes | steps | Yes | **Remain temporarily** — no enrollment |
| outreach_sequence_steps | Yes | Yes | Via sequence | sequence | Yes | **Remain temporarily** |
| sequence_enrollments | **No** | — | — | — | — | **MISSING** — needed for real sequences |
| email_accounts | Yes | Yes | Yes | messages, inbox | Yes | **Remain** |
| messages | Yes | Yes | Yes | inbox conversation | Yes | **Remain** |
| email_events | Yes | Yes | Yes | message | Yes | **Remain** |
| inbox_conversations | Yes | Yes | Yes | messages, opp/lead | Yes | **Remain** (real inbox) |
| conversations | Yes | Yes | Yes | **lead-only** | Yes | **Legacy parallel** to inbox |
| email_suppressions | Yes | Yes | Yes | org | Yes | **Remain** (= suppression) |
| tasks | Yes | Yes | Yes | lead/opp/deal/company | Yes | **Remain** |
| meetings | Yes | Yes | Yes | opp/lead/deal | Yes | **Remain** |
| proposals | Yes | Yes | Yes | opp/deal | Yes | **Remain** |
| proposal_versions | Yes | Yes | Via proposal | proposal | Yes | **Remain** |
| deals | Yes | Yes | Yes | revenue, meetings | Yes | **Remain** (= pipeline) |
| revenue | Yes | Yes | Yes | deal | Yes | **Remain** |
| ai_usage_logs | Yes | Yes | **Optional** | org? | Yes | **Remain** — tighten org required |
| ai_recommendations | Yes | Yes | Yes | org | Yes | **Remain** |
| ai_conversations | Yes | Partial | No | user | Partial | **Deprecate / migrate** |
| learning_events | Yes | Yes | Yes | org, opportunity? | Yes | **Remain** |
| notifications | **No** | — | — | — | — | **MISSING** |
| audit_logs | Yes | Yes | Optional | org, user | Partial | **Remain** — expand usage |
| billing_webhook_events | Yes | Yes | No (global Stripe) | — | Yes | **Remain** (= webhook_events for billing) |
| generic webhook_events | **No** | — | — | — | — | Covered by billing + connector secrets |
| job_logs | Yes | Partial | **No** | — | Yes | **Migrate** — add orgId |
| follow_up_jobs | Yes | Yes | Yes | campaign/lead | Yes | **Remain** (legacy automation queue) |
| background_jobs (generic) | **No** | — | — | — | — | **MISSING** as unified queue; use job_logs + follow_up |
| plans | Yes | Yes | No | features, subs | Yes | **Remain** |
| plan_features | Yes | Yes | Via plan | plan | Yes | **Remain** |
| subscriptions | Yes | Yes | Yes (1:1) | plan, org | Yes | **Remain** |
| usage_records | Yes | Yes | Yes | org | Yes | **Remain** |
| agent_goals | Yes | Yes | Yes | runs | Yes | **Remain** |
| agent_runs | Yes | Yes | Yes | actions | Yes | **Remain** |
| agent_actions | Yes | Yes | Yes | run | Yes | **Remain** |
| **leads** (legacy) | Yes | Yes | Yes | campaigns, notes, automation | **Heavy use** | **Remain temporarily** for backward compat; migrate → Company+Contact+Opportunity+Signal |
| lead_research / lead_scores | Yes | Yes | Via lead | lead | Yes | **Legacy** |
| notes | Yes | Minimal | **No** | lead | Yes | **Migrate** — add orgId; IDOR risk |
| activities | Yes | Minimal | **No** | lead/deal | Yes | **Migrate** — add orgId; IDOR risk |
| campaign_leads | Yes | Yes | Via campaign | — | Yes | **Legacy** |
| linkedin_discovery_jobs | Yes | Yes | Yes | — | Yes | **Legacy** parallel to connectors |
| linkedin_accounts | Yes | Yes | Via user | — | Yes | **Remain** |
| user_integrations | Yes | Yes | Yes | — | Yes | **Remain** (BYOK) |
| autopilot_configs | Yes | Yes | Yes | — | Yes | **Remain** |
| integration_products | Yes | Yes | No | marketplace | Light | **Remain / platform** |
| settings | Yes | Global singleton-ish | No | — | Light | **Deprecate** if unused |
| sessions / password_reset_tokens | Yes | Yes | Session has activeOrganizationId | user | Yes | **Remain** |
| tags / lead_tags | Yes | Yes | tags have org | leads | Yes | **Legacy** with leads |

\*“Columns Complete” = adequate for current product code, not necessarily ideal product completeness.

---

## Disposition legend (do not execute yet)

1. **Remain** — fits target model  
2. **Migrate** — keep data; add org scope / normalize  
3. **Deprecate** — stop writing; remove later  
4. **Replace** — superseded by another model  
5. **Remain temporarily** — needed for live features until migration  

---

## Critical schema gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| `notes`, `activities` without `organizationId` | **Critical** | Enables IDOR when services don’t join through org-scoped lead |
| `job_logs` without `organizationId` | **High** | Cross-tenant job telemetry / harder isolation audits |
| No `sequence_enrollments` | **High** | Outreach sequences cannot execute |
| No `notifications` | **Medium** | No in-app notification center |
| Dual inbox models (`conversations` vs `inbox_conversations`) | **High** (architecture) | Confusing product surface |
| Dual identity (`User.role` vs `organization_users.role`) | **Critical** (authz) | See SECURITY_AUDIT |
| `AIUsageLog.organizationId` optional | **Medium** | Risk of unscoped AI metering rows |

---

## Indexes (spot check)

Present on most tenant tables: `@@index([organizationId])`, opportunity stage/score, signal fingerprint unique per org.

**Likely gaps:** full-text search indexes; composite indexes for common list filters (org+stage+owner); pagination cursors not schema-level.

---

## STOP

No migrations proposed for execution. See `FEATURE_GAP_MATRIX.md` for priority.
