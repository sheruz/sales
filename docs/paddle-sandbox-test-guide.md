# Paddle sandbox test guide (B3)

Official cards: [Paddle sandbox test cards](https://developer.paddle.com/concepts/payment-methods/card#test-payment-method)

## Prerequisites

1. Paddle **Sandbox** account (separate from Live).
2. Env on the sales app:
   - `PADDLE_ENV=sandbox`
   - `PADDLE_API_KEY` (sandbox API key)
   - `PADDLE_CLIENT_TOKEN` (sandbox client-side token, usually `test_…`)
   - `PADDLE_WEBHOOK_SECRET` (from the sandbox notification destination)
   - `PAYMENTS_ENABLED=false` until the smoke list below is green
3. Notification destination in **sandbox-vendors.paddle.com** → Developer tools → Notifications:
   - URL: `{APP_URL}/api/billing/webhooks/paddle`
   - Events: `transaction.completed`, `transaction.payment_failed`, `subscription.created`, `subscription.updated`, `subscription.canceled`, `subscription.past_due`, `subscription.resumed`, `adjustment.created` (refunds)
4. Super Admin → Packages → open Starter/Growth → **Resync** (creates sandbox `ProviderPriceMap` rows).
5. Confirm dry-run: `node scripts/b3-dry-run.js` shows schema ready + Delvix excluded.

## Test cards (sandbox only)

Any cardholder name · any future expiry · any CVC · any ZIP.

| Outcome | Card number |
|--------|-------------|
| **Success** (no 3DS) | `4242 4242 4242 4242` |
| **Success** Visa debit | `4000 0566 5566 5556` |
| **Success** with 3DS | `4000 0038 0000 0446` |
| **Decline** | `4000 0000 0000 0002` |
| **Failed renewal** (first charge OK, later renewals decline) | `4000 0027 6000 3184` |

Real cards are rejected in sandbox. Live cards never work with sandbox keys.

## Flow A — Happy path subscribe

1. Tenant with `billingProvider=PADDLE`, subscription `NONE`.
2. Set `PAYMENTS_ENABLED=true`, `pm2 restart sales` (or your sales process).
3. Tenant admin → Choose Plan → Growth monthly → checkout overlay (locale EN, currency USD).
4. Pay with `4242 4242 4242 4242`.
5. Land on `/billing/activating` (polls; **does not** activate from the redirect alone).
6. Paddle: transaction completed + subscription created.
7. Delvix: webhook `processed`, subscription `ACTIVE`, credits granted once, modules unlocked.
8. In Paddle Notifications → redeliver the same event → Delvix ignores duplicate (`event_id` unique).

## Flow B — Decline at checkout

1. Same as A with `4000 0000 0000 0002`.
2. Delvix stays locked / `NONE`; no credits.

## Flow C — Renewal (sandbox)

**Webhook simulator (recommended)** — [docs](https://developer.paddle.com/webhooks/simulator/subscription-renewed):

1. Sandbox dashboard → **Developer tools → Events → Simulations** (or **Paddle → Events → Simulations**).
2. Create simulation type **`subscription_renewal`**.
3. Point it at your notification destination (`…/api/billing/webhooks/paddle`).
4. Optionally attach a real sandbox `subscription_id` so payloads match your tenant.
5. Set `payment_outcome` = **`success`** → Run.
6. Expect signed webhooks: `subscription.updated`, `transaction.created` / `billed` / `paid` / `completed`.
7. Delvix: period dates updated + monthly credits once (`paddle_tx:{transactionId}`).

Note: simulator events are correctly signed but **do not mutate** the real Paddle subscription entity; they are for webhook-handler QA. For end-to-end ledger against a real sub, also use the failed-renewal card (Flow D) or wait a short billing period.

## Flow D — Failed renewal → PAST_DUE → SUSPENDED

**Option A — real card path**

1. Subscribe with **failed renewal** card `4000 0027 6000 3184` (first payment succeeds).
2. When the next period bills, Paddle declines → `transaction.payment_failed` / `subscription.past_due`.

**Option B — simulator**

1. Simulations → type **`subscription_renewal`**.
2. Set `payment_outcome` = **`failed`** (optional: `dunning_exhausted_action` = cancel or pause).
3. Run → expect `transaction.payment_failed`, `transaction.past_due`, `subscription.past_due`.

Then in Delvix:

1. `PAST_DUE` + grace (`BILLING_GRACE_DAYS`, default 7) + payment-failed email.
2. After grace (lifecycle cron): `SUSPENDED` — outbound paused, inbound still runs.
3. Recover: portal / update card to `4242…` → webhook → `ACTIVE`.

## Flow E — Cancel / resume

**In product**

1. Tenant Settings → Billing → **Cancel at period end**.
2. Delvix: `cancelAtPeriodEnd=true`.
3. **Resume subscription** before period end → clears scheduled cancel.

**In Paddle dashboard**

1. Catalog → **Subscriptions** → open sub → Cancel (immediate or next billing period).
2. Or Simulations → type **`subscription_cancellation`** with `effective_from: next_billing_period` or `immediately`.
3. Resume: clear scheduled change in Paddle, or Simulations → **`subscription_resume`**.

## Flow F — Refund

1. Sandbox → **Transactions** → open a paid transaction → **Refund** / create adjustment.
2. Sandbox **auto-approves** refunds about every **10 minutes**.
3. Delvix audit `billing.refund` (from `adjustment.created` / related events). Chargeback/dispute → `billing.chargeback` + subscription `SUSPENDED` until SA resolves.

## Flow G — Top-up

1. Billing → Buy credits → pack → Paddle one-time checkout with `4242…`.
2. Ledger `PURCHASE` once for that transaction id.

## Flow H — Manual Payoneer

1. SA sets tenant `billingProvider=MANUAL_PAYONEER`.
2. Tenant Request invoice → OPEN invoice under SA Invoices.
3. SA pastes Payoneer payment-request URL → tenant pays → SA **Mark paid** (reason required).
4. ACTIVE + credits once; second Mark paid rejected.

## Delvix owner

`PLATFORM_OWNER_ORG_ID` never appears in checkout, sync, or invoices. Dry-run confirms exclusion.

## Turn payments on for sandbox QA

```bash
# after Flows A–B green
# set PAYMENTS_ENABLED=true in .env
pm2 restart sales
```

## Production (later — not Phase 6)

1. Live Paddle keys + Live webhook URL (same path).
2. `PADDLE_ENV=production`, new secrets, Resync packages (creates **production** price maps).
3. Never reuse sandbox customer/price/subscription ids.
