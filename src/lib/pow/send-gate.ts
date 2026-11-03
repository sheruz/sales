/**
 * PoW send gate.
 * - Env POW_SEND_ENABLED=false|0|no → emergency force OFF (always).
 * - Otherwise Super Admin global + per-tenant settings decide.
 * Reads env directly so unit tests don't need full env bootstrap.
 */

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";

const PLATFORM_KEY = "pow_send_enabled";

function envForcesOff(): boolean {
  const raw = process.env.POW_SEND_ENABLED;
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    // Unset → do not force off; SA toggles decide
    return false;
  }
  const t = String(raw).trim().toLowerCase();
  // Explicit false forces OFF. Explicit true / other → do not force off.
  return t === "false" || t === "0" || t === "no" || t === "off";
}

function asBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const enabled = (value as Record<string, unknown>).enabled;
    if (typeof enabled === "boolean") return enabled;
  }
  return null;
}

/** Sync env-only check (tests / bootstrap). Prefer isPowSendEnabledForOrg in prod paths. */
export function isPowSendEnabled(): boolean {
  if (envForcesOff()) return false;
  // Without org context, only allow if env is explicitly true (legacy).
  const raw = String(process.env.POW_SEND_ENABLED ?? "")
    .trim()
    .toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export async function getPowSendGlobalEnabled(): Promise<boolean> {
  const row = await prisma.platformSetting.findUnique({
    where: { key: PLATFORM_KEY },
  });
  if (!row) return false;
  return asBool(row.value) === true;
}

export async function setPowSendGlobalEnabled(
  enabled: boolean,
  actorUserId: string | null
): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key: PLATFORM_KEY },
    create: {
      key: PLATFORM_KEY,
      value: { enabled },
      updatedByUserId: actorUserId,
    },
    update: {
      value: { enabled },
      updatedByUserId: actorUserId,
    },
  });
}

/** null = inherit global */
export async function getPowSendTenantOverride(
  organizationId: string
): Promise<boolean | null> {
  const row = await prisma.organizationSettings.findUnique({
    where: { organizationId },
    select: { settings: true },
  });
  const raw = row?.settings;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = (raw as Record<string, unknown>).pow_send_enabled;
  if (v === undefined || v === null) return null;
  return asBool(v);
}

export async function setPowSendTenantOverride(
  organizationId: string,
  enabled: boolean | null,
  actorUserId?: string | null
): Promise<void> {
  const existing = await prisma.organizationSettings.findUnique({
    where: { organizationId },
    select: { settings: true },
  });
  const base: Record<string, Prisma.InputJsonValue> =
    existing?.settings &&
    typeof existing.settings === "object" &&
    !Array.isArray(existing.settings)
      ? { ...(existing.settings as Record<string, Prisma.InputJsonValue>) }
      : {};
  if (enabled === null) {
    delete base.pow_send_enabled;
  } else {
    base.pow_send_enabled = enabled;
  }
  const settings = base as Prisma.InputJsonValue;
  await prisma.organizationSettings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      settings,
    },
    update: { settings },
  });
  void actorUserId;
}

/**
 * Effective send permission for an org.
 * Env force-OFF always wins. Else tenant override, else global SA toggle.
 */
export async function isPowSendEnabledForOrg(
  organizationId: string
): Promise<boolean> {
  if (envForcesOff()) return false;
  const tenant = await getPowSendTenantOverride(organizationId);
  if (tenant === false) return false;
  if (tenant === true) return true;
  return getPowSendGlobalEnabled();
}

export async function assertPowSendAllowed(sequence: {
  isProofOfWork?: boolean | null;
  name?: string | null;
  organizationId?: string | null;
}): Promise<void> {
  const isPow =
    Boolean(sequence.isProofOfWork) ||
    String(sequence.name || "").toLowerCase() === "proof of work";
  if (!isPow) return;

  const orgId = sequence.organizationId;
  const ok = orgId
    ? await isPowSendEnabledForOrg(orgId)
    : isPowSendEnabled();

  if (!ok) {
    throw new Error(
      "Proof of Work send is disabled (Super Admin toggle or POW_SEND_ENABLED kill switch)"
    );
  }
}

export const POW_SEND_PLATFORM_KEY = PLATFORM_KEY;
