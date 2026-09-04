# Phase 3 — Completion Report

**Status:** Implemented (additive runtime) — awaiting approval  
**Do not start Phase 4 until approved.**

## Audited architecture

Inspected: Campaign / CampaignLead, OutreachSequence / Steps, FollowUpJob / Autopilot, EmailAccount / inboxService / emailSafetyService, legacy Conversation vs InboxConversation, cron `/api/cron/automation`.

**Finding:** Sequences were definition-only; runtime was Lead `FollowUpJob`. Phase 3 adds Opportunity/Contact `SequenceEnrollment` + executor reusing inbox send.

## New architecture

```text
Opportunity / Contact
→ Campaign (optional)
→ OutreachSequence
→ SequenceEnrollment
→ Executor (claim ACTIVE→PROCESSING)
→ inboxService.sendOutreach
→ InboxConversation / Message
→ Reply / Meeting / Stop
```

## Database

| Change | Detail |
|--------|--------|
| Tables | `sequence_enrollments`, `sequence_enrollment_executions` |
| Column | `campaigns.default_sequence_id` (nullable FK) |
| Enums | `SequenceEnrollmentStatus`, `SequenceEnrollmentStopReason`, `SequenceExecutionStatus` |
| Indexes | org/status/next_run, FKs; **partial unique** open enrollments `(org, sequence, contact)` |
| Migration | `npm run db:migrate:sequences` → `scripts/phase3-sequences-migrate.js` |
| Data deleted | **None**; legacy row counts asserted |

## APIs

| Method | Path |
|--------|------|
| GET/POST | `/api/sequences/[id]/enrollments` |
| GET | `/api/enrollments` |
| GET | `/api/enrollments/[id]` |
| POST | `/api/enrollments/[id]/pause\|resume\|stop\|retry` |
| POST | `/api/cron/automation` (also runs sequence executor) |

Permissions: `sequences.manage` \| `campaigns.manage` \| `opportunities.view/update` (anyOf). Client `organizationId` ignored.

## UI

- `/dashboard/sequences`, `/dashboard/sequences/[id]`
- Opportunity + Contact detail: enrollment panel (enroll/pause/resume/stop/retry)
- Campaign detail: canonical enrollment list (legacy leads unchanged)
- Sidebar: Sequences

## Executor

| Concern | Approach |
|---------|----------|
| Claiming | Conditional `updateMany` ACTIVE→PROCESSING + `claimToken` |
| Stale claims | Reclaim PROCESSING older than 5 minutes |
| Idempotency | `seq-enroll:{id}:step:{n}` → Message + Execution unique |
| Retries | Exponential backoff; `maxRetries` → FAILED |
| Scheduling | Persist `nextRunAt` from step `delayMinutes` |
| Stop | Reply (inbox hook), unsubscribe, suppressed, meeting, opp closed, sequence/campaign inactive |
| Limits | Account (emailSafety) + org `dailyEmailLimit` (defer) |
| Email | **Only** `inboxService.sendOutreach` |

## Legacy compatibility

CampaignLead, FollowUpJob, Autopilot, aiOutreach path **unchanged**. Lead not required for SequenceEnrollment.

## Known limitations

- Sales reps enroll via `opportunities.update` but cannot open Sequences UI (`sequences.manage` only)
- Non-EMAIL sequence channels are skipped (not LinkedIn)
- Reply stop depends on inbox sync creating REPLIED events
- No sequence create/edit UI redesign (API + list/detail only)
- Concurrent claim is optimistic (not `FOR UPDATE SKIP LOCKED`); safe via status+token

## Production migration (do not run until approved)

```bash
npm run db:generate
npm run db:migrate:sequences
```

**Not** `prisma db push`.

## Production hardening (post-approval)

### Org daily email limit
- Source of truth: `OrganizationSettings.dailyEmailLimit` + outbound `Message` counts (SCHEDULED|SENT|…) since UTC midnight
- Enforced in `emailSafetyService.assertOrgDailyLimit` via `pg_advisory_xact_lock`
- Also gated inside `inboxService.sendOutreach` under the same lock before draft create
- Executor defers to next UTC midnight with SKIPPED execution; does **not** increment retryCount / FAILED

### sequences.view
- Added to permission catalog; Sales Rep + managers/admins; GET sequences/enrollments use `sequences.view` OR `sequences.manage`
- `sequences.manage` still required for create/update/archive

### Email idempotency (honest)
- **DB:** unique `(organizationId, idempotencyKey)` on Message; SENT messages returned without re-calling provider
- **App retries:** FAILED/SCHEDULED drafts resume the same row; account `dailySent` increments only on first SENT event per message
- **Not exactly-once at provider:** if the provider accepts mail and the process dies before persisting SENT, a later resume may call the provider again — documented limitation

### Production migrate note (TEXT vs UUID)

Production DB PKs are **TEXT** (from tenancy migrate), not PostgreSQL `uuid`.
`db:migrate:sequences` detects parent `id` column types and creates FKs to match.
If a prior run failed mid-create, re-run — the script is idempotent and does not delete legacy rows.

**STOP — do not start Phase 4 until approved.**
