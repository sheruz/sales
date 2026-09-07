# Architecture rules (developer-facing)

## Canonical CRM (Revenue OS)

Prefer these entities for **new** product work:

- Company, Contact, Signal, Opportunity
- InboxConversation / Message
- Meeting, Proposal, Deal, Revenue
- Business Brain, ICP, Services/Offers, Revenue Goals, Source connectors
- **Campaign → OutreachSequence → SequenceEnrollment → Executor** (Phase 3–4)

## Canonical campaign runtime (Phase 4)

```text
Campaign
      ↓
defaultSequence / sequenceId
      ↓
Contact (+ optional Opportunity)
      ↓
SequenceEnrollment (stepsSnapshot)
      ↓
Sequence Executor (cron)
      ↓
inboxService.sendOutreach
      ↓
InboxConversation / Message
```

**Rules:**

- New enrollments MUST NOT require `Lead`
- `SequenceEnrollment.leadId` / `campaignLeadId` are optional bridge fields
- Reuse `inboxService` + `emailSafetyService` — do **not** add a second email send engine
- Duplicate open enrollments blocked (partial unique + app check)
- Running enrollments use `stepsSnapshot` — live sequence edits do not rewrite in-flight steps
- PAUSED sequence/campaign **defers** execution; ARCHIVED/DRAFT **stops**

## Legacy runtime (still active)

```text
Lead
  ↓
CampaignLead → Campaign
  ↓
Autopilot / FollowUpJob / FollowUpSequence (JSON)
  ↓
aiOutreachService / sendEmailForUser
  ↓
Legacy Conversation
```

**On-demand bridge (Phase 4):**

```text
CampaignLead → Lead bridge → Company+Contact → SequenceEnrollment
(+ cancel PENDING/PROCESSING FollowUpJobs for that lead)
```

**Duplicate-send protection:** `detectLegacyCanonicalConflict` blocks legacy
`runPipeline` / Autopilot and cancels due FollowUpJobs when `CampaignLead.bridgedAt`
or an open SequenceEnrollment exists for the lead / linked contact / matching email.

Do **not** bulk dual-write every CampaignLead.

## Legacy Lead freeze

`Lead` (and CampaignLead / lead-only Conversation) remain for **compatibility**.

**Do not:**

- Add new features that *require* a Lead to exist
- Make Opportunity or SequenceEnrollment creation depend on Lead
- Treat Lead as the long-term CRM center of gravity
- Delete or retire Leads in Phase 4

**Do:**

- Keep existing lead flows working
- Use `lead-migration.service` / CampaignLead bridge for optional migration
- Prefer SequenceEnrollment for new outreach automation

## Authorization

Customer APIs use Phase 1 org RBAC only:

`requireOrgPermission` / `requireAnyOrgPermission` + `{ id, organizationId }` lookups.

Never trust client-supplied `organizationId` for authorization.

## Controlled migrations

Use `npm run db:migrate:*` scripts. Never `prisma db push` or `migrate reset` on production.
