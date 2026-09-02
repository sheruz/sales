import type { IntegrationPlatform } from "@prisma/client";

export interface IntegrationCatalogItem {
  platform: IntegrationPlatform;
  name: string;
  description: string;
  monthlyPriceCents: number;
  sortOrder: number;
  fields: Array<{
    key: string;
    label: string;
    type: "password" | "text" | "email" | "number";
    placeholder?: string;
    required?: boolean;
  }>;
}

/** Paid integration catalog — users connect their own accounts (BYOK) */
export const INTEGRATION_CATALOG: IntegrationCatalogItem[] = [
  {
    platform: "OPENAI",
    name: "OpenAI",
    description:
      "Your OpenAI API key powers lead discovery, research, and outreach. Billed directly by OpenAI.",
    monthlyPriceCents: 0,
    sortOrder: 1,
    fields: [{ key: "apiKey", label: "API Key", type: "password", placeholder: "sk-proj-...", required: true }],
  },
  {
    platform: "ANTHROPIC",
    name: "Anthropic (Claude)",
    description:
      "Optional Claude API key. Use if you prefer Anthropic models for email copy.",
    monthlyPriceCents: 0,
    sortOrder: 2,
    fields: [{ key: "apiKey", label: "API Key", type: "password", placeholder: "sk-ant-...", required: true }],
  },
  {
    platform: "EMAIL_SMTP",
    name: "Email (SMTP)",
    description:
      "Send outreach from your own business email. Required for autopilot and email automation.",
    monthlyPriceCents: 0,
    sortOrder: 3,
    fields: [
      { key: "smtpHost", label: "SMTP Host", type: "text", placeholder: "smtp.gmail.com", required: true },
      { key: "smtpPort", label: "SMTP Port", type: "number", placeholder: "587", required: true },
      { key: "smtpUser", label: "SMTP Username", type: "email", required: true },
      { key: "smtpPassword", label: "SMTP Password / App Password", type: "password", required: true },
      { key: "fromName", label: "From Name", type: "text", placeholder: "Your Company" },
      { key: "fromEmail", label: "From Email", type: "email", required: true },
    ],
  },
  {
    platform: "LINKEDIN",
    name: "LinkedIn",
    description:
      "Official OAuth connection to your LinkedIn account. LinkedIn messaging requires a paid LinkedIn plan and approved API access.",
    monthlyPriceCents: 999,
    sortOrder: 4,
    fields: [],
  },
];

export function formatPrice(cents: number): string {
  if (cents === 0) return "Bring your own key";
  return `$${(cents / 100).toFixed(0)}/mo platform fee`;
}
