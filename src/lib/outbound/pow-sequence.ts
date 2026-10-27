/** Default Proof of Work sequence (PoW2). Editable per org after seed. */

import { POW_SEQUENCE_NAME } from "@/lib/pow/constants";

export { POW_SEQUENCE_NAME };

export const POW_OUTREACH_STEPS = [
  {
    stepOrder: 1,
    delayMinutes: 0,
    emailStyle: "PLAIN" as const,
    subjectTemplate: `{{pow_subject_day0}}`,
    bodyTemplate: `{{pow_body_day0}}

{{preview_url}}

{{pow_footer}}`,
  },
  {
    stepOrder: 2,
    delayMinutes: 3 * 24 * 60,
    emailStyle: "PLAIN" as const,
    subjectTemplate: `Re: {{pow_subject_day0}}`,
    bodyTemplate: `{{pow_body_day3}}

{{pow_footer}}`,
  },
  {
    stepOrder: 3,
    delayMinutes: 7 * 24 * 60,
    emailStyle: "PLAIN" as const,
    subjectTemplate: `Re: {{pow_subject_day0}}`,
    bodyTemplate: `{{pow_body_day7}}

{{pow_footer}}`,
  },
  {
    stepOrder: 4,
    delayMinutes: 14 * 24 * 60,
    emailStyle: "PLAIN" as const,
    subjectTemplate: `Re: {{pow_subject_day0}}`,
    bodyTemplate: `{{pow_body_day14}}

{{pow_footer}}`,
  },
] as const;
