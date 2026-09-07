# Phase 4 — Campaign Migration, Sequence Builder & Lead Bridge

Status: **IMPLEMENTED** (awaiting production migration approval)

## 1. Canonical campaign architecture

```text
Campaign
   ↓
defaultSequence (optional) + explicit sequenceId
   ↓
Contact (+ optional Opportunity)
   ↓
SequenceEnrollment (source=CAMPAIGN, stepsSnapshot)
   ↓
SequenceExecutor → inboxService.sendOutreach
```

- Lead is **not** required.
- `POST /api/campaigns/[id]/enrollments` creates enrollment.
- `GET /api/campaigns/[id]/enrollments` lists enrollments.
- When `sequenceId` is omitted, `campaign.defaultSequenceId` is used.

## 2. Legacy CampaignLead architecture (unchanged)

```text
Campaign → CampaignLead → Lead → FollowUpJob / Autopilot
```

`CampaignLead` rows are never deleted. Legacy UI/stats remain on the campaign page.

## 3. Bridge behavior

### Lead → Company/Contact

`POST /api/leads/[id]/bridge` (Phase 2) remains. Idempotent, org-scoped.

### CampaignLead → canonical enrollment

`POST /api/campaigns/[id]/campaign-leads/[campaignLeadId]/bridge`

Flow:

1. Bridge Lead → Company + Contact (idempotent)
2. Cancel **PENDING** `FollowUpJob`s for that lead
3. Create `SequenceEnrollment` (`source=CAMPAIGN_LEAD_BRIDGE`, `campaignLeadId`)
4. Set `CampaignLead.bridgedAt`

Rules:

- Never deletes CampaignLead / Lead / FollowUpJob / Conversation
- Does not disable Autopilot globally
- Idempotent (returns existing enrollment if already bridged)
- Requires ACTIVE sequence (explicit or campaign default)
- Does **not** auto-create Opportunity

## 4. Sequence builder

Dashboard:

- `/dashboard/sequences` — list + create
- `/dashboard/sequences/new` — builder
- `/dashboard/sequences/[id]` — edit builder + enrollments

Permissions:

- `sequences.manage` — create/edit/activate/pause/archive/steps
- `sequences.view` — read-only

Channel support for execution: **EMAIL only**. Other channels may be stored but are skipped at runtime.

## 5. Sequence lifecycle

| Status   | Edit | Enroll | Execute |
|----------|------|--------|---------|
| DRAFT    | Yes  | No     | No (stop if somehow due) |
| ACTIVE   | Yes* | Yes    | Yes |
| PAUSED   | Yes  | No     | Defer (not permanent stop) |
| ARCHIVED | No†  | No     | Stop (SEQUENCE_INACTIVE) |

\* Step edits do not rewrite running enrollment snapshots.  
† Restore status before editing content.

## 6. Duplicate-send protection

Per CampaignLead / lead:

1. On bridge: cancel PENDING FollowUpJobs for that lead
2. On FollowUpJob processing: if `CampaignLead.bridgedAt` **or** open `SequenceEnrollment` for the lead → cancel job and skip send

Does **not** globally disable legacy automation.

## 7. Sequence edit / snapshot strategy

**Option B — Enrollment snapshot**

At enroll time, `SequenceEnrollment.stepsSnapshot` stores step config (order, delay, channel, subject, body, isActive).

Executor uses `resolveEnrollmentSteps()`:

1. Prefer `stepsSnapshot`
2. Else fall back to live `sequence.steps` (legacy enrollments)

Editing an ACTIVE sequence updates the template for **new** enrollments only.

## 8. Authorization

All new customer APIs:

```text
requireUser → requireOrgPermission / requireAnyOrgPermission
→ resource lookup with organizationId from membership
```

Client `organizationId` is ignored.

## 9. Migration strategy

```bash
npm run db:migrate:campaigns
# → scripts/phase4-campaign-migrate.js
```

Additive only:

- `SequenceEnrollmentSource` enum
- `sequence_enrollments.source`
- `sequence_enrollments.steps_snapshot`
- `sequence_enrollments.campaign_lead_id` (+ FK, unique)
- `campaign_leads.bridged_at`
- indexes

Id type detection (TEXT vs UUID). Row-count assertions. Fail closed on unresolved FKs.

**Do not** run production migrate without explicit approval.

## 10. Known limitations

- Opportunity picker on campaign UI filters client-side from opportunity list
- No LinkedIn/Meta execution
- No bulk CampaignLead migration
- Legacy Autopilot still runs for non-bridged leads
- Existing enrollments without snapshot fall back to live steps until re-enrolled

## 11. Phase 5 (not started)

Suggested next:

- Gradual CampaignLead dual-path cutover tooling
- Enrollment analytics / deliverability dashboard
- Optional Opportunity auto-link heuristics
- Lead retirement plan (only after dual-path proven)

**DO NOT start Phase 5 until Phase 4 is approved.**
