/** Default Cold outreach sequence templates (pitch vars + email styles). */

export const COLD_OUTREACH_NAME = "Cold outreach";
export const INBOUND_OUTREACH_NAME = "Inbound outreach";

export const COLD_OUTREACH_STEPS = [
  {
    stepOrder: 1,
    delayMinutes: 0,
    emailStyle: "BRANDED" as const,
    subjectTemplate: `{{company_name}} — quick idea`,
    bodyTemplate: `{{greeting}}

{{intro_html}}

{{finding_title}}

{{finding_text}}

{{body_html}}`,
  },
  {
    stepOrder: 2,
    delayMinutes: 3 * 24 * 60,
    emailStyle: "PLAIN" as const,
    subjectTemplate: `Re: {{company_name}} — quick idea`,
    bodyTemplate: `{{greeting}}

Circling back on {{finding_title}}.

{{body_html}}

Happy to share a short example of {{recommended_service}} if useful.`,
  },
  {
    stepOrder: 3,
    delayMinutes: 7 * 24 * 60,
    emailStyle: "PLAIN" as const,
    subjectTemplate: `Re: {{company_name}} — quick idea`,
    bodyTemplate: `{{greeting}}

Last note from me — if {{finding_title}} isn't a priority, no worries at all.

If it is, I can outline how {{recommended_service}} usually helps teams like {{company_name}}.`,
  },
] as const;

/** Inbound / Meta — all BRANDED. */
export const INBOUND_OUTREACH_STEPS = [
  {
    stepOrder: 1,
    delayMinutes: 0,
    emailStyle: "BRANDED" as const,
    subjectTemplate: `{{company_name}} — next steps`,
    bodyTemplate: `{{greeting}}

{{intro_html}}

{{finding_title}}

{{finding_text}}

{{body_html}}`,
  },
] as const;
