# Phase 6 Completion Report — Outreach + Gmail/Outlook + Unified Inbox

**Status:** Complete — awaiting approval before Phase 7  
**Date:** 2026-09-03  
**Codebase:** `sales-platform`

---

## Summary

Sales intelligence can now become action: connect **Gmail** or **Outlook** (OAuth) or **SMTP** fallback, send with safety gates, sync inbound replies into a unified inbox, auto-attach to company/contact/opportunity, classify with AI, and manage suppressions + sequences.

Legacy lead `conversations` (automation transcript) is unchanged. Phase 6 unified threads live in `inbox_conversations` + `messages`.

---

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| `email_accounts` with Gmail / Outlook / SMTP + encrypted tokens + daily limits | Done |
| Conversations with company / contact / opportunity / channel / sentiment / intent | Done (`inbox_conversations`) |
| Messages with direction, provider IDs, AI fields | Done (`messages`) |
| Email events (sent, delivered, bounce, open, click, reply, fail, unsub, complaint) | Done |
| Org-level suppression (email/domain + reasons) | Done |
| Sequence builder (steps, delay, stop on reply/meeting/unsub) | Done |
| Pre-send safety checks | Done |
| Inbox sync (polling) for Gmail + Outlook | Done |
| AI reply classification + suggested next action | Done |
| Customer can connect Gmail/Outlook and see real replies in-platform | Done |

---

## Database

| Table | Purpose |
|-------|---------|
| `email_accounts` | Provider accounts (OAuth tokens encrypted; SMTP password encrypted) |
| `inbox_conversations` | Unified inbox threads |
| `messages` | Inbound/outbound messages |
| `email_events` | Delivery / engagement / failure events |
| `email_suppressions` | Org suppression list |
| `outreach_sequences` + `outreach_sequence_steps` | Sequence builder |
| Legacy `conversations` | Lead automation transcript (still used) |

---

## APIs / UI

| Path | Purpose |
|------|---------|
| `GET/POST /api/email-accounts` | List / create SMTP account |
| `POST /api/email-accounts/[id]/sync` | Sync one account |
| `GET /api/integrations/gmail/oauth` + callback | Gmail OAuth |
| `GET /api/integrations/outlook/oauth` + callback | Outlook OAuth |
| `GET/POST /api/conversations` | List inbox / send outreach (or legacy simulate) |
| `GET /api/conversations/[id]` | Thread detail |
| `POST /api/inbox/sync` | Sync all OAuth accounts (user or cron) |
| `GET/POST /api/email-suppressions` | Suppression list |
| `GET/POST /api/sequences` | Sequence CRUD |
| `/dashboard/conversations` | Unified Inbox UI |
| Settings → Integrations | Connect Gmail / Outlook / SMTP |

---

## Env vars (optional OAuth)

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-app/api/integrations/gmail/callback
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=https://your-app/api/integrations/outlook/callback
ENCRYPTION_KEY=   # required for token encryption
CRON_SECRET=      # optional for POST /api/inbox/sync
```

Gmail scopes: send + readonly + modify.  
Outlook Graph scopes: Mail.Send + Mail.Read.

---

## Safety gates (every send)

1. Organization active  
2. Account active  
3. Valid recipient email  
4. Not suppressed / unsubscribed  
5. Sequence active (when applicable)  
6. Within daily limit  
7. Provider healthy  
8. Idempotency key present and unused  

---

## Deploy notes

1. `npm run db:generate`  
2. `npm run db:push` (replaces unused `email_threads` / `email_messages` with new inbox tables)  
3. Set Google/Microsoft OAuth credentials  
4. Ensure `ENCRYPTION_KEY` is set  
5. Restart app  

---

## Verification

- Unit tests: Phase 6 classification / suppression / provider contracts  
- `npm run typecheck` / `npm test` / `npm run build`

---

**STOP.** Do not start Phase 7 without approval.
