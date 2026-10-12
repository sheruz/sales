/** Default Cold outreach sequence templates (plain text, pitch vars). */

export const COLD_OUTREACH_NAME = "Cold outreach";

export const COLD_OUTREACH_STEPS = [
  {
    stepOrder: 1,
    delayMinutes: 0,
    subjectTemplate: `{{company_name}} — quick idea`,
    bodyTemplate: `Hi {{first_name}},

{{personalized_first_line}}

{{short_pitch}}

Worth a quick look?

Best`,
  },
  {
    stepOrder: 2,
    delayMinutes: 3 * 24 * 60,
    subjectTemplate: `Re: {{company_name}} — quick idea`,
    bodyTemplate: `Hi {{first_name}},

Circling back on {{top_issue}}.

{{short_pitch}}

Happy to share a short example of {{recommended_service}} if useful.

Best`,
  },
  {
    stepOrder: 3,
    delayMinutes: 7 * 24 * 60,
    subjectTemplate: `Re: {{company_name}} — quick idea`,
    bodyTemplate: `Hi {{first_name}},

Last note from me — if {{top_issue}} isn't a priority, no worries at all.

If it is, I can outline how {{recommended_service}} usually helps teams like {{company_name}}.

Best`,
  },
] as const;
