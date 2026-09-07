# INBOUND SYNC BUG — FINAL REPORT

Date: 2026-09-07  
Scope: Inbound Sync Inbox only. No Phase 5. No CRM redesign. No Lead retirement.

---

## Root Cause

**Primary:** Sync Inbox only syncs **Gmail / Outlook OAuth** accounts. The production smoke test used **SMTP** (`Settings → Email SMTP`). `syncAllForOrg` never queried SMTP accounts for inbound mail, returned an empty result set, and the UI still toasted **“Inbox synced from Gmail/Outlook”** — a silent false success. The Gmail reply was never fetched.

**Secondary (would break Gmail OAuth after connect):**
- Contact match used exact `email` only (ignored `normalizedEmail` / case).
- Thread match relied on `providerThreadId`; SMTP outbound has no Gmail `threadId`.
- Nested Gmail multipart bodies were incompletely parsed.
- Sync errors could be swallowed into a generic success toast.

---

## Exact Fix

1. Structured sync summary: detect zero OAuth accounts + SMTP present → **warning**, not fake success.
2. UI shows `warning` / real import counts / account errors.
3. Contact resolution via `normalizedEmail` + case-insensitive `email` (no Lead required).
4. Thread resolution via `In-Reply-To` / `References` → outbound `providerMessageId`, then prior outbound `toEmail`, then open contact conversation.
5. Gmail fetch: recursive multipart body extraction; capture `In-Reply-To` / `References`.
6. Structured logs (no tokens/passwords/bodies).
7. Settings copy clarifies SMTP = outbound-only; Gmail OAuth required for Sync.

**Not done (by design / constraint):** No new IMAP engine. SMTP cannot call Gmail API without OAuth.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/email/inbound-sync.ts` | **New** helpers (Message-ID, contact where, Gmail bodies, sync summary) |
| `src/services/inbox.service.ts` | Sync summary, ingest matching, Gmail fetch improvements, logging |
| `src/app/api/inbox/sync/route.ts` | Return full sync payload |
| `src/components/conversations/unified-inbox.tsx` | Accurate toast / warnings |
| `src/components/settings/integrations-panel.tsx` | SMTP vs Gmail copy |
| `src/lib/email/phase6-inbox-sync.test.ts` | **New** regression tests |
| `docs/INBOUND_SYNC_ROOT_CAUSE.md` | Audit notes |
| `docs/INBOUND_SYNC_BUG_REPORT.md` | This report |

---

## Database Changes

**None.**

---

## Gmail Sync Behavior

- Still: `messages.list` with `in:inbox newer_than:14d` (max 40).
- Still requires **GMAIL** (or OUTLOOK) `EmailAccount` with valid OAuth tokens.
- SMTP accounts are counted as skipped and explained in the API/UI warning.

---

## Thread Matching

Order:

1. Dedupe by `providerMessageId` (inbound ≠ outbound id)
2. `providerThreadId` = Gmail `threadId`
3. `In-Reply-To` / `References` → outbound Message-ID
4. Open `InboxConversation` for matched Contact
5. Prior OUTBOUND message to this from-address
6. Else create conversation (Company/Contact/Opportunity when resolvable; Lead optional)

---

## Deduplication

Unchanged key: `organizationId + providerMessageId`.  
Re-running Sync does not duplicate. Subject alone never dedupes.

---

## Company/Contact/Opportunity Linking

Contact via email / `normalizedEmail`. Opportunity via contact/company. Lead only if present by email — **not required**.

---

## Security/Tenant Isolation

All lookups remain `{ organizationId, … }`. Sync uses session org. No client `organizationId`. No SUPER_ADMIN bypass.

---

## Tests

```text
Test files: 18 passed
Tests:      153 passed
```

New coverage: Message-ID normalize, contact where, nested multipart, SMTP silent-success warning, tenant contract.

---

## Build/Typecheck

```text
Typecheck: PASS
Tests:     PASS (153)
Build:     PASS
Lint:      not re-run (pre-existing failures elsewhere)
```

---

## Manual Verification Steps

1. Deploy / restart app with this build.
2. **Settings → Integrations → Connect Gmail** (OAuth).  
   SMTP alone will now show a **warning** on Sync: “SMTP is outbound-only…”.
3. Ensure `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / redirect URI are set if Gmail connect fails.
4. Send a sequence email again (or use existing thread).
5. Reply from recipient Gmail.
6. Click **Sync inbox**.
7. Expect toast like `Imported 1 new message(s)` and the reply in the same thread as INBOUND.
8. Sync again → no duplicate.

---

## Phase 1–4 Regression Impact

| Area | Impact |
|------|--------|
| Phase 1 security | Unchanged (org-scoped) |
| Phase 2 CRM | Contact match improved; Lead not required |
| Phase 3/4 sequences | Reply → `stopForContactReply` still runs after ingest |
| Legacy conversations | Still dual-written only when Lead exists |

---

## What you must do on the server

Your current setup is **SMTP-only**. After deploy:

1. Connect **Gmail OAuth** for `shahrozmalik8@gmail.com`
2. Click Sync inbox again

Until Gmail OAuth is connected, Sync cannot import the Gmail reply (by design — no second email engine / IMAP added).

---

**STOP — Do not start Phase 5.**
