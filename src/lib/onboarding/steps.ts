export const ONBOARDING_STEPS = [
  "business_profile",
  "services_case_studies",
  "target_customers",
  "integrations",
  "mailbox_dns",
  "email_branding",
  "review",
  "start_autopilot",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const ONBOARDING_STEP_META: Record<
  OnboardingStep,
  { title: string; blurb: string }
> = {
  business_profile: {
    title: "Business profile",
    blurb: "Company name, website, and what you sell.",
  },
  services_case_studies: {
    title: "Services & case studies",
    blurb: "Add at least one service Autopilot can pitch.",
  },
  target_customers: {
    title: "Target customers",
    blurb: "Pick an ICP template or define who you sell to.",
  },
  integrations: {
    title: "Integrations",
    blurb: "Connect AI and tools allowed on your plan.",
  },
  mailbox_dns: {
    title: "Mailbox + DNS",
    blurb: "Add a sending mailbox and check SPF/DKIM.",
  },
  email_branding: {
    title: "Email branding",
    blurb: "Sender identity and business address for emails.",
  },
  review: {
    title: "Review",
    blurb: "Confirm setup before starting Autopilot.",
  },
  start_autopilot: {
    title: "Start Autopilot",
    blurb: "Enable Autopilot in shadow mode (no live sends yet).",
  },
};

export function isOnboardingStep(v: string): v is OnboardingStep {
  return (ONBOARDING_STEPS as readonly string[]).includes(v);
}

export function nextStep(current: OnboardingStep): OnboardingStep | null {
  const i = ONBOARDING_STEPS.indexOf(current);
  if (i < 0 || i >= ONBOARDING_STEPS.length - 1) return null;
  return ONBOARDING_STEPS[i + 1];
}
