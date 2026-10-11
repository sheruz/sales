import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";

export type FeatureFlags = {
  /** Legacy Leads, Autopilot panel, CampaignLead UI surfaces */
  legacy_enabled: boolean;
  /** Sources page + hiring/funding/web scraper connector runs */
  sources_enabled: boolean;
  /** Partial Meta connector (Phase 7 rebuilds Lead Ads) */
  meta_connector_enabled: boolean;
  /** Campaign LinkedIn URL paste + AI Prospect Finder UI */
  linkedin_discovery_ui_enabled: boolean;
};

function envBool(value: boolean | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value;
}

/** Env defaults for Client Autopilot Phase 0 (cleanup). */
export function getEnvFeatureFlagDefaults(): FeatureFlags {
  return {
    legacy_enabled: envBool(env.LEGACY_ENABLED, false),
    sources_enabled: envBool(env.SOURCES_ENABLED, false),
    meta_connector_enabled: envBool(env.META_CONNECTOR_ENABLED, false),
    linkedin_discovery_ui_enabled: envBool(
      env.LINKEDIN_DISCOVERY_UI_ENABLED,
      false
    ),
  };
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
}

/**
 * Feature flags: organization_settings.settings overrides env defaults.
 * Missing org → env defaults only.
 */
export async function getFeatureFlags(
  organizationId?: string | null
): Promise<FeatureFlags> {
  const defaults = getEnvFeatureFlagDefaults();
  if (!organizationId) return defaults;

  const row = await prisma.organizationSettings.findUnique({
    where: { organizationId },
    select: { settings: true },
  });

  const raw = row?.settings;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return defaults;
  }

  const s = raw as Record<string, unknown>;
  return {
    legacy_enabled: asBool(s.legacy_enabled, defaults.legacy_enabled),
    sources_enabled: asBool(s.sources_enabled, defaults.sources_enabled),
    meta_connector_enabled: asBool(
      s.meta_connector_enabled,
      defaults.meta_connector_enabled
    ),
    linkedin_discovery_ui_enabled: asBool(
      s.linkedin_discovery_ui_enabled,
      defaults.linkedin_discovery_ui_enabled
    ),
  };
}

/** Connector types disabled when sources_enabled is false. */
export const DISABLED_SOURCE_TYPES_WHEN_SOURCES_OFF = [
  "HIRING",
  "FUNDING",
  "WEB_RESEARCH",
  "RFP_TENDER",
  "LINKEDIN",
  "META",
  "INSTAGRAM",
] as const;
