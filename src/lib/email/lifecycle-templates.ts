/**
 * B5a: default lifecycle email templates + {{var}} interpolation.
 */

export type LifecycleTemplateDef = {
  key: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: string[];
};

export const LIFECYCLE_TEMPLATE_DEFAULTS: LifecycleTemplateDef[] = [
  {
    key: "trial_ending_3d",
    name: "Trial ending (3 days)",
    subject: "Your trial ends in 3 days — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Your trial for <strong>{{orgName}}</strong> ends on <strong>{{trialEndsAt}}</strong> (3 days).</p><p>Choose a plan to keep access.</p>",
    bodyText:
      "Hi {{adminName}},\n\nYour trial for {{orgName}} ends on {{trialEndsAt}} (3 days).\nChoose a plan to keep access.\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "trialEndsAt", "ctaUrl", "supportEmail"],
  },
  {
    key: "trial_ending_1d",
    name: "Trial ending (1 day)",
    subject: "Last day of your trial — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Your trial for <strong>{{orgName}}</strong> ends tomorrow (<strong>{{trialEndsAt}}</strong>).</p><p>Subscribe now to avoid interruption.</p>",
    bodyText:
      "Hi {{adminName}},\n\nYour trial for {{orgName}} ends tomorrow ({{trialEndsAt}}).\nSubscribe now to avoid interruption.\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "trialEndsAt", "ctaUrl", "supportEmail"],
  },
  {
    key: "trial_expired",
    name: "Trial expired",
    subject: "Your trial has ended — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>The trial for <strong>{{orgName}}</strong> has ended. Your data is safe — pick a plan to reactivate.</p>",
    bodyText:
      "Hi {{adminName}},\n\nThe trial for {{orgName}} has ended. Your data is safe — pick a plan to reactivate.\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "ctaUrl", "supportEmail"],
  },
  {
    key: "payment_failed_0",
    name: "Payment failed (day 0)",
    subject: "Payment failed — action needed for {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>We could not charge your payment method for <strong>{{orgName}}</strong>. Please update your card to avoid suspension (grace until <strong>{{graceEndsAt}}</strong>).</p>",
    bodyText:
      "Hi {{adminName}},\n\nWe could not charge your payment method for {{orgName}}. Please update your card to avoid suspension (grace until {{graceEndsAt}}).\n\n{{ctaUrl}}",
    variables: [
      "orgName",
      "adminName",
      "graceEndsAt",
      "ctaUrl",
      "supportEmail",
    ],
  },
  {
    key: "payment_failed_3",
    name: "Payment failed (day 3)",
    subject: "Reminder: payment still failed — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Payment for <strong>{{orgName}}</strong> is still outstanding (day 3). Update your payment method before <strong>{{graceEndsAt}}</strong>.</p>",
    bodyText:
      "Hi {{adminName}},\n\nPayment for {{orgName}} is still outstanding (day 3). Update your payment method before {{graceEndsAt}}.\n\n{{ctaUrl}}",
    variables: [
      "orgName",
      "adminName",
      "graceEndsAt",
      "ctaUrl",
      "supportEmail",
    ],
  },
  {
    key: "payment_failed_6",
    name: "Payment failed (day 6)",
    subject: "Final notice: payment failed — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Final notice for <strong>{{orgName}}</strong>: without payment before <strong>{{graceEndsAt}}</strong>, the workspace will be suspended.</p>",
    bodyText:
      "Hi {{adminName}},\n\nFinal notice for {{orgName}}: without payment before {{graceEndsAt}}, the workspace will be suspended.\n\n{{ctaUrl}}",
    variables: [
      "orgName",
      "adminName",
      "graceEndsAt",
      "ctaUrl",
      "supportEmail",
    ],
  },
  {
    key: "suspended",
    name: "Workspace suspended",
    subject: "Workspace suspended — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p><strong>{{orgName}}</strong> is suspended due to unpaid billing. Outbound is paused; inbox still syncs. Pay to restore access.</p>",
    bodyText:
      "Hi {{adminName}},\n\n{{orgName}} is suspended due to unpaid billing. Outbound is paused; inbox still syncs. Pay to restore access.\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "ctaUrl", "supportEmail"],
  },
  {
    key: "reactivated",
    name: "Workspace reactivated",
    subject: "Welcome back — {{orgName}} is active",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Payment received. <strong>{{orgName}}</strong> is active again and jobs can resume.</p>",
    bodyText:
      "Hi {{adminName}},\n\nPayment received. {{orgName}} is active again and jobs can resume.\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "ctaUrl", "supportEmail"],
  },
  {
    key: "cancellation_scheduled",
    name: "Cancellation scheduled",
    subject: "Cancellation scheduled — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Your subscription for <strong>{{orgName}}</strong> will end on <strong>{{periodEnd}}</strong>. You keep access until then.</p>",
    bodyText:
      "Hi {{adminName}},\n\nYour subscription for {{orgName}} will end on {{periodEnd}}. You keep access until then.\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "periodEnd", "ctaUrl", "supportEmail"],
  },
  {
    key: "canceled_export_reminder",
    name: "Canceled + export reminder",
    subject: "Subscription ended — export your data ({{orgName}})",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p><strong>{{orgName}}</strong> is canceled. Download a data export while you still have access (read-only until <strong>{{readOnlyUntil}}</strong>).</p>",
    bodyText:
      "Hi {{adminName}},\n\n{{orgName}} is canceled. Download a data export while you still have access (read-only until {{readOnlyUntil}}).\n\n{{ctaUrl}}",
    variables: [
      "orgName",
      "adminName",
      "readOnlyUntil",
      "ctaUrl",
      "supportEmail",
    ],
  },
  {
    key: "downgrade_reminder_7d",
    name: "Downgrade reminder (7 days)",
    subject: "Choose what stays active — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Your plan limits for <strong>{{featureKey}}</strong> take effect on <strong>{{deadlineAt}}</strong>. Choose which items stay active.</p>",
    bodyText:
      "Hi {{adminName}},\n\nYour plan limits for {{featureKey}} take effect on {{deadlineAt}}. Choose which items stay active.\n\n{{ctaUrl}}",
    variables: [
      "orgName",
      "adminName",
      "featureKey",
      "deadlineAt",
      "allowedCount",
      "ctaUrl",
      "supportEmail",
    ],
  },
  {
    key: "plan_limit_notice",
    name: "Plan limit notice",
    subject: "Plan limit change — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Your plan now allows <strong>{{allowedCount}}</strong> {{featureKey}}. Extras pause on <strong>{{deadlineAt}}</strong> unless you choose what stays.</p>",
    bodyText:
      "Hi {{adminName}},\n\nYour plan now allows {{allowedCount}} {{featureKey}}. Extras pause on {{deadlineAt}} unless you choose what stays.\n\n{{ctaUrl}}",
    variables: [
      "orgName",
      "adminName",
      "featureKey",
      "allowedCount",
      "deadlineAt",
      "ctaUrl",
      "supportEmail",
    ],
  },
  {
    key: "low_credits_20",
    name: "Low credits (20%)",
    subject: "Credits running low — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Credit balance for <strong>{{orgName}}</strong> is at or below 20% of your monthly allotment ({{balance}} left).</p>",
    bodyText:
      "Hi {{adminName}},\n\nCredit balance for {{orgName}} is at or below 20% of your monthly allotment ({{balance}} left).\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "balance", "ctaUrl", "supportEmail"],
  },
  {
    key: "low_credits_5",
    name: "Low credits (5%)",
    subject: "Credits critically low — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Only about 5% of monthly credits remain for <strong>{{orgName}}</strong> ({{balance}} left). Top up soon.</p>",
    bodyText:
      "Hi {{adminName}},\n\nOnly about 5% of monthly credits remain for {{orgName}} ({{balance}} left). Top up soon.\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "balance", "ctaUrl", "supportEmail"],
  },
  {
    key: "low_credits_0",
    name: "Out of credits",
    subject: "Out of credits — Autopilot paused ({{orgName}})",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p><strong>{{orgName}}</strong> has 0 credits. Credit-consuming jobs are paused until you add credits. Inbound replies still sync.</p>",
    bodyText:
      "Hi {{adminName}},\n\n{{orgName}} has 0 credits. Credit-consuming jobs are paused until you add credits. Inbound replies still sync.\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "balance", "ctaUrl", "supportEmail"],
  },
  {
    key: "manual_renewal_reminder",
    name: "Manual renewal reminder",
    subject: "Invoice due soon — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Your manual invoice for <strong>{{orgName}}</strong> renews around <strong>{{periodEnd}}</strong>. Pay invoice <strong>{{invoiceNumber}}</strong> to stay active.</p>",
    bodyText:
      "Hi {{adminName}},\n\nYour manual invoice for {{orgName}} renews around {{periodEnd}}. Pay invoice {{invoiceNumber}} to stay active.\n\n{{ctaUrl}}",
    variables: [
      "orgName",
      "adminName",
      "periodEnd",
      "invoiceNumber",
      "amount",
      "ctaUrl",
      "supportEmail",
    ],
  },
  {
    key: "payment_received",
    name: "Payment received",
    subject: "Payment received — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>We received your payment for <strong>{{orgName}}</strong>{{#amount}} ({{amount}} {{currency}}){{/amount}}. Thank you.</p>",
    bodyText:
      "Hi {{adminName}},\n\nWe received your payment for {{orgName}}. Thank you.\n\n{{ctaUrl}}",
    variables: [
      "orgName",
      "adminName",
      "amount",
      "currency",
      "ctaUrl",
      "supportEmail",
    ],
  },
];

export const LIFECYCLE_TEMPLATE_KEYS = LIFECYCLE_TEMPLATE_DEFAULTS.map(
  (t) => t.key
);

/** Replace {{var}} placeholders. Unknown keys → empty string. */
export function interpolateTemplate(
  template: string,
  vars: Record<string, string | number | null | undefined>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    if (v == null) return "";
    return String(v);
  });
}

export function sampleVarsForTemplate(key: string): Record<string, string> {
  const base: Record<string, string> = {
    orgName: "Acme Demo Co",
    adminName: "Alex",
    trialEndsAt: "2026-11-01",
    graceEndsAt: "2026-11-05",
    periodEnd: "2026-11-15",
    readOnlyUntil: "2026-12-15",
    featureKey: "users",
    allowedCount: "3",
    deadlineAt: "2026-11-07",
    balance: "120",
    invoiceNumber: "INV-1001",
    amount: "149.00",
    currency: "USD",
    ctaUrl: "https://app.example.com/settings?tab=billing",
    supportEmail: "support@example.com",
  };
  void key;
  return base;
}
