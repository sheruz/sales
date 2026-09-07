# INBOUND SYNC BUG — ROOT CAUSE REPORT

## Sync entry point
- UI: `unified-inbox.tsx` → `POST /api/inbox/sync`
- Auth: `requireOrgPermission("integrations.manage")`
- Service: `inboxService.syncAllForOrg(organizationId)`

## Gmail provider implementation
- `syncAllForOrg` only loads accounts where `provider IN (GMAIL, OUTLOOK)`
- SMTP accounts are **excluded** from the query
- `syncAccount` for SMTP explicitly returns `{ synced: 0, note: "SMTP accounts use outbound-only..." }` if reached

## Exact API request/query (Gmail OAuth only)
```
GET https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=in:inbox newer_than:14d
```

## Actual result for this environment
- Outbound sequence send used **SMTP** EmailAccount (Settings → Email SMTP)
- Sync finds **zero** Gmail/Outlook OAuth accounts → returns `[]`
- UI toasts **"Inbox synced from Gmail/Outlook"** anyway (silent false success)
- Reply was never fetched from Gmail

## Whether the reply is fetched
**No** — not fetched at all under SMTP-only configuration.

## Whether it is persisted / linked / filtered
N/A — never reached ingest.

## UI hide?
No — backend returned empty success.

## Exact root cause
1. **Primary:** Sync Inbox does not pull inbound mail for SMTP accounts; production user connected SMTP, not Gmail OAuth.
2. **Secondary:** Silent success toast hides zero-account / zero-synced outcome.
3. **Secondary (would bite after OAuth/IMAP):** `ingestInbound` matches contacts by exact `email` only, not `normalizedEmail` (we already saw contact.email vs normalized diverge).
4. **Secondary:** SMTP outbound stores nodemailer Message-ID without Gmail `threadId`, so thread match must fall back to contact / In-Reply-To.

## Minimal fix
1. IMAP inbound fetch for SMTP accounts (same credentials; Gmail app password works on imap.gmail.com).
2. Include SMTP in `syncAllForOrg`.
3. Match contacts via `normalizedEmail` + case-insensitive email; match threads via In-Reply-To → outbound Message-ID.
4. Return structured sync stats; UI shows real counts / warnings.
5. Improve Gmail multipart body extraction for OAuth path.

## Files to change
- `src/services/inbox.service.ts`
- `src/lib/email/imap-inbound.ts` (new)
- `src/components/conversations/unified-inbox.tsx`
- `src/lib/email/phase6-inbox-sync.test.ts` (new tests)
- `package.json` (+ imapflow)
- `docs/INBOUND_SYNC_BUG_REPORT.md` (final report)

## Tests
Unit tests for: contact email matching helpers, Message-ID normalization, In-Reply-To thread resolution contracts, SMTP sync inclusion, silent-success messaging contracts.
