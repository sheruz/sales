/**
 * S1 provider catalog — string providerIds (no schema change for new providers).
 * Calendar/Zoom are stubs (Connect disabled).
 */

export type ProviderCategory =
  | "AI"
  | "DATA"
  | "ENRICHMENT"
  | "EMAIL"
  | "SOCIAL"
  | "CALENDAR"
  | "MEETINGS"
  | "ADS"
  | "OTHER";

export type ProviderAuthType =
  | "API_KEY"
  | "OAUTH2"
  | "SERVER_TO_SERVER_OAUTH"
  | "SMTP_IMAP"
  | "WEBHOOK";

export type ProviderCatalogEntry = {
  id: string;
  name: string;
  category: ProviderCategory;
  authType: ProviderAuthType;
  allowsMultiple: boolean;
  /** When false, Connect UI is disabled (stub). */
  connectEnabled: boolean;
  oauthModes?: Array<"PLATFORM_APP" | "TENANT_APP">;
  /** MANAGED mode offer — OFF by default for all. */
  managedModeAvailable: boolean;
  planConnectionLimitKey?: string;
  helpUrl?: string;
  legacyPlatform?: string;
};

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: "anthropic",
    name: "Claude (Anthropic)",
    category: "AI",
    authType: "API_KEY",
    allowsMultiple: false,
    connectEnabled: true,
    managedModeAvailable: false,
    legacyPlatform: "ANTHROPIC",
  },
  {
    id: "openai",
    name: "OpenAI",
    category: "AI",
    authType: "API_KEY",
    allowsMultiple: false,
    connectEnabled: true,
    managedModeAvailable: false,
    legacyPlatform: "OPENAI",
  },
  {
    id: "google_places",
    name: "Google Places",
    category: "DATA",
    authType: "API_KEY",
    allowsMultiple: false,
    connectEnabled: true,
    managedModeAvailable: false,
    legacyPlatform: "GOOGLE_PLACES",
  },
  {
    id: "pagespeed",
    name: "PageSpeed Insights",
    category: "DATA",
    authType: "API_KEY",
    allowsMultiple: false,
    connectEnabled: true,
    managedModeAvailable: false,
  },
  {
    id: "hunter",
    name: "Hunter.io",
    category: "ENRICHMENT",
    authType: "API_KEY",
    allowsMultiple: false,
    connectEnabled: true,
    managedModeAvailable: false,
    legacyPlatform: "HUNTER",
  },
  {
    id: "gmail",
    name: "Gmail",
    category: "EMAIL",
    authType: "OAUTH2",
    allowsMultiple: true,
    connectEnabled: true,
    oauthModes: ["PLATFORM_APP", "TENANT_APP"],
    managedModeAvailable: false,
  },
  {
    id: "outlook",
    name: "Outlook",
    category: "EMAIL",
    authType: "OAUTH2",
    allowsMultiple: true,
    connectEnabled: true,
    oauthModes: ["PLATFORM_APP", "TENANT_APP"],
    managedModeAvailable: false,
  },
  {
    id: "smtp",
    name: "SMTP / IMAP",
    category: "EMAIL",
    authType: "SMTP_IMAP",
    allowsMultiple: true,
    connectEnabled: true,
    managedModeAvailable: false,
    legacyPlatform: "EMAIL_SMTP",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    category: "SOCIAL",
    authType: "OAUTH2",
    allowsMultiple: false,
    connectEnabled: true,
    oauthModes: ["PLATFORM_APP"],
    managedModeAvailable: false,
    legacyPlatform: "LINKEDIN",
  },
  {
    id: "meta",
    name: "Meta (Lead Ads)",
    category: "ADS",
    authType: "OAUTH2",
    allowsMultiple: false,
    connectEnabled: true,
    oauthModes: ["PLATFORM_APP", "TENANT_APP"],
    managedModeAvailable: false,
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    category: "CALENDAR",
    authType: "OAUTH2",
    allowsMultiple: false,
    connectEnabled: false,
    oauthModes: ["PLATFORM_APP", "TENANT_APP"],
    managedModeAvailable: false,
  },
  {
    id: "zoom",
    name: "Zoom",
    category: "MEETINGS",
    authType: "OAUTH2",
    allowsMultiple: false,
    connectEnabled: false,
    oauthModes: ["PLATFORM_APP", "TENANT_APP"],
    managedModeAvailable: false,
  },
];

export function getProvider(id: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find((p) => p.id === id);
}
