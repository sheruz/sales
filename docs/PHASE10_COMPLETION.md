# Phase 10 Completion Report — Billing + Plans + Usage + Entitlements

**Status:** Complete — awaiting approval before next phase  
**Date:** 2026-09-04  
**Codebase:** `sales-platform`

---

## Summary

The platform is commercial SaaS-ready: plans, plan features, org subscriptions, usage metering, server-side entitlement gates, Stripe checkout/portal/webhooks (idempotent), and self-serve signup.

---

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Signup → select plan → pay → entitlements → use → hit limits → upgrade | Done |
| `plans` / `plan_features` / `subscriptions` / usage | Done |
| Server-side limit enforcement (never frontend-only) | Done |
| Stripe checkout, upgrades/downgrades, cancel, renewal, failed payment | Done |
| Idempotent webhook processing (`billing_webhook_events.event_id`) | Done |

---

## Data model

- `plans`, `plan_features`
- `subscriptions` (1:1 org)
- `usage_records` (period metrics)
- `billing_webhook_events` (idempotency)

Default plans: **Free / Growth / Scale** (`src/lib/billing/features.ts`).

---

## Enforcement (server)

| Feature | Gate |
|---------|------|
| AI calls / tokens | `aiComplete` |
| Emails | inbox send |
| Opportunities | create paths |
| Sources / connectors | create + run |
| Sequences / inbox accounts / users | seat checks |
| Automation | start batch |
| Advanced AI / enrichment | opportunity intelligence |
| Learning | pattern discovery |

---

## APIs / UI

| Path | Purpose |
|------|---------|
| `GET /api/plans` | Public plan catalog |
| `GET /api/billing` | Subscription + usage snapshot |
| `POST /api/billing/checkout` | Upgrade/downgrade / Checkout |
| `POST /api/billing/portal` | Stripe Customer Portal |
| `POST /api/billing/webhook` | Stripe webhooks (raw body) |
| `POST /api/auth/signup` | Self-serve org + Free sub (+ optional Checkout) |
| `/signup` | Signup UI |
| Settings → Billing | Plan, usage, upgrade |

---

## Deploy notes

1. `npm run db:generate`
2. `npm run db:push` (plans, plan_features, subscriptions, usage_records, billing_webhook_events)
3. Set Stripe env vars (see `.env.example`)
4. Map Growth/Scale `stripePriceId` in DB
5. Point Stripe webhook to `/api/billing/webhook`
6. Restart app

Without Stripe keys, Free plan works; paid checkout returns a clear configuration error.

---

## Verification

- Phase 10 contract tests
- `npm run typecheck` / `npm test` / `npm run build`

---

**STOP.** Do not start the next phase without approval.
