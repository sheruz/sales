/**
 * Super Admin Outreach send gate (Default Workspace).
 * Default OFF. Logged via PlatformAuditLog on toggle.
 */

import prisma from "@/lib/db/prisma";

const PLATFORM_KEY = "platform_outreach_send_enabled";

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

export async function getPlatformOutreachSendEnabled(): Promise<boolean> {
  const row = await prisma.platformSetting.findUnique({
    where: { key: PLATFORM_KEY },
  });
  if (!row) return false;
  return asBool(row.value) === true;
}

export async function setPlatformOutreachSendEnabled(
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

export { PLATFORM_KEY as PLATFORM_OUTREACH_SEND_KEY };
