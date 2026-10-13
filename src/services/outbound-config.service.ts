import prisma from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { DEFAULT_COUNTRY_ALLOW_LIST } from "@/lib/outbound/country-allowlist";

export type OutboundConfig = {
  enabled: boolean;
  /** When true, mark SENT without calling the provider */
  shadowMode: boolean;
  dailyGlobalCap: number;
  countryAllowList: string[];
  /** Separate from enrichment allowAcceptAll — default OFF */
  allowAcceptAll: boolean;
  physicalAddress: string;
  businessName: string;
  disableLegacySends: boolean;
  pausedDomains: string[];
  maxEnrollPerTick: number;
  maxSendPerTick: number;
};

export const DEFAULT_OUTBOUND: OutboundConfig = {
  enabled: false,
  shadowMode: true,
  dailyGlobalCap: 40,
  countryAllowList: [...DEFAULT_COUNTRY_ALLOW_LIST],
  allowAcceptAll: false,
  physicalAddress: "",
  businessName: "",
  disableLegacySends: true,
  pausedDomains: [],
  maxEnrollPerTick: 5,
  maxSendPerTick: 5,
};

export function asOutboundConfig(raw: unknown): OutboundConfig {
  const s =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).outbound
      : null;
  const o =
    s && typeof s === "object" && !Array.isArray(s)
      ? (s as Record<string, unknown>)
      : {};
  return {
    enabled: o.enabled === true,
    shadowMode: o.shadowMode !== false,
    dailyGlobalCap: Number(o.dailyGlobalCap ?? DEFAULT_OUTBOUND.dailyGlobalCap),
    countryAllowList: Array.isArray(o.countryAllowList)
      ? (o.countryAllowList as string[]).filter((x) => typeof x === "string")
      : [...DEFAULT_COUNTRY_ALLOW_LIST],
    allowAcceptAll: o.allowAcceptAll === true,
    physicalAddress:
      typeof o.physicalAddress === "string" ? o.physicalAddress : "",
    businessName: typeof o.businessName === "string" ? o.businessName : "",
    disableLegacySends: o.disableLegacySends !== false,
    pausedDomains: Array.isArray(o.pausedDomains)
      ? (o.pausedDomains as string[]).filter((x) => typeof x === "string")
      : [],
    maxEnrollPerTick: Number(
      o.maxEnrollPerTick ?? DEFAULT_OUTBOUND.maxEnrollPerTick
    ),
    maxSendPerTick: Number(o.maxSendPerTick ?? DEFAULT_OUTBOUND.maxSendPerTick),
  };
}

/** Orgs that use Delvix Autopilot (sourcing/enrichment/audit/outbound). */
export function isRevenueOsOrgSettings(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const s = raw as Record<string, unknown>;
  return Boolean(s.sourcing || s.enrichment || s.audit || s.outbound);
}

export class OutboundConfigService {
  async getConfig(organizationId: string): Promise<OutboundConfig> {
    const row = await prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { settings: true },
    });
    return asOutboundConfig(row?.settings);
  }

  async setConfig(
    organizationId: string,
    patch: Partial<OutboundConfig>
  ): Promise<OutboundConfig> {
    const current = await this.getConfig(organizationId);
    const next: OutboundConfig = {
      ...current,
      ...patch,
      enabled:
        patch.enabled === undefined ? current.enabled : Boolean(patch.enabled),
      shadowMode:
        patch.shadowMode === undefined
          ? current.shadowMode
          : Boolean(patch.shadowMode),
      allowAcceptAll:
        patch.allowAcceptAll === undefined
          ? current.allowAcceptAll
          : Boolean(patch.allowAcceptAll),
      disableLegacySends:
        patch.disableLegacySends === undefined
          ? current.disableLegacySends
          : Boolean(patch.disableLegacySends),
      dailyGlobalCap: Math.min(
        500,
        Math.max(1, patch.dailyGlobalCap ?? current.dailyGlobalCap)
      ),
      countryAllowList: patch.countryAllowList ?? current.countryAllowList,
      physicalAddress: patch.physicalAddress ?? current.physicalAddress,
      businessName: patch.businessName ?? current.businessName,
      pausedDomains: patch.pausedDomains ?? current.pausedDomains,
      maxEnrollPerTick: Math.min(
        25,
        Math.max(1, patch.maxEnrollPerTick ?? current.maxEnrollPerTick)
      ),
      maxSendPerTick: Math.min(
        25,
        Math.max(1, patch.maxSendPerTick ?? current.maxSendPerTick)
      ),
    };

    const existing = await prisma.organizationSettings.findUnique({
      where: { organizationId },
    });
    const prev =
      existing?.settings &&
      typeof existing.settings === "object" &&
      !Array.isArray(existing.settings)
        ? { ...(existing.settings as Record<string, unknown>) }
        : {};
    prev.outbound = next;

    await prisma.organizationSettings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        settings: prev as Prisma.InputJsonValue,
      },
      update: { settings: prev as Prisma.InputJsonValue },
    });
    return next;
  }

  async pauseDomain(organizationId: string, domain: string) {
    const cfg = await this.getConfig(organizationId);
    const d = domain.toLowerCase();
    if (!cfg.pausedDomains.includes(d)) {
      await this.setConfig(organizationId, {
        pausedDomains: [...cfg.pausedDomains, d],
      });
    }
  }

  async isLegacyDisabled(organizationId: string): Promise<boolean> {
    const row = await prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { settings: true },
    });
    if (!row?.settings) return false;
    if (!isRevenueOsOrgSettings(row.settings)) return false;
    return asOutboundConfig(row.settings).disableLegacySends;
  }
}

export const outboundConfigService = new OutboundConfigService();
