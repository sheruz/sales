# Proof of Work outreach — spec tracker

Source of truth for build status. Implementation docs: `POW1_AUDIT_WORKER.md`, `POW2_EMAIL_WRITER.md`, `POW3_SEND.md`, `POW5_BILLING_GATE.md`, `POW6_PREVIEW_PAGE.md`.

| Spec item | Status | Notes |
|-----------|--------|-------|
| Deep audit worker (Playwright) | **Done** | PoW1 |
| Email writer + Day 0/3/7/14 drafts | **Done** | PoW2 |
| Approve → enroll + PLAIN send path | **Done** | PoW3 (send gated) |
| Preview page `/for/{slug}` with findings, screenshots, offer, case study, CTA | **Done** | PoW6 |
| Preview safety: noindex, 60-day expiry, Not relevant? → suppress | **Done** | PoW6 |
| Visit tracking + human filter + hot-lead alert + Hot leads list | **Done** | PoW6 |
| Credits `audit_deep=3`, `preview_page=3` as own actions | **Done** | PoW6 (`AUDIT_DEEP` / `PREVIEW_PAGE` metrics) |
| Send switch Super Admin (global + per-tenant) + audit log; env force OFF | **Done** | PoW6 |
| Plan gate `proof_of_work` Pro/Agency | **Done** | PoW5 billing gate |
| AI mockup of the fix | **Deferred** | PoW7a |
| A/B experiments + funnel dashboard | **Deferred** | PoW7b |

Nothing half-built for deferred items — no stub services/routes.
