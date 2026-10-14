import prisma from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import {
  asAiReplyConfig,
  DEFAULT_AI_REPLY,
  type AiReplyConfig,
  type HoldTriggerId,
} from "@/lib/ai-reply/config";

export type AiReplyConfigPatch = Partial<
  Omit<AiReplyConfig, "autoSendByClass">
> & {
  autoSendByClass?: Partial<AiReplyConfig["autoSendByClass"]>;
};

function readSettingsObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {};
}

/** True when settings JSON has an explicit aiReply block (org has opted in/configured). */
export function hasAiReplyConfig(raw: unknown): boolean {
  const s = readSettingsObject(raw).aiReply;
  return Boolean(s && typeof s === "object" && !Array.isArray(s));
}

export class AiReplyConfigService {
  async getConfig(organizationId: string): Promise<AiReplyConfig> {
    const row = await prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { settings: true },
    });
    return asAiReplyConfig(row?.settings);
  }

  async setConfig(
    organizationId: string,
    patch: AiReplyConfigPatch
  ): Promise<AiReplyConfig> {
    const current = await this.getConfig(organizationId);

    const merged: AiReplyConfig = {
      ...current,
      ...patch,
      mode: patch.mode ?? current.mode,
      killSwitch:
        patch.killSwitch === undefined
          ? current.killSwitch
          : Boolean(patch.killSwitch),
      shadow:
        patch.shadow === undefined ? current.shadow : Boolean(patch.shadow),
      notInterestedSendClose:
        patch.notInterestedSendClose === undefined
          ? current.notInterestedSendClose
          : Boolean(patch.notInterestedSendClose),
      nonEnglishHold:
        patch.nonEnglishHold === undefined
          ? current.nonEnglishHold
          : Boolean(patch.nonEnglishHold),
      confidenceThreshold: Math.min(
        1,
        Math.max(
          0.1,
          Number(patch.confidenceThreshold ?? current.confidenceThreshold)
        )
      ),
      maxRepliesPerConversation: Math.min(
        20,
        Math.max(
          1,
          Math.floor(
            Number(
              patch.maxRepliesPerConversation ??
                current.maxRepliesPerConversation
            )
          )
        )
      ),
      autoSendByClass: {
        ...current.autoSendByClass,
        ...(patch.autoSendByClass ?? {}),
      },
      holdTriggers: (patch.holdTriggers ?? current.holdTriggers) as HoldTriggerId[],
      classifyModel: (patch.classifyModel ?? current.classifyModel).trim(),
      draftModel: (patch.draftModel ?? current.draftModel).trim(),
    };

    // Normalise through the canonical parser (drops unknown triggers, clamps, etc.)
    const next = asAiReplyConfig({ aiReply: merged });

    const existing = await prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { settings: true },
    });
    const prev = readSettingsObject(existing?.settings);
    prev.aiReply = next;

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

  /** Reset to defaults (mode stays DRAFT_ONLY — safe). */
  async resetConfig(organizationId: string): Promise<AiReplyConfig> {
    return this.setConfig(organizationId, { ...DEFAULT_AI_REPLY });
  }

  /** Org ids whose OrganizationSettings.settings contains an aiReply block. */
  async listConfiguredOrganizationIds(): Promise<string[]> {
    const rows = await prisma.organizationSettings.findMany({
      select: { organizationId: true, settings: true },
    });
    return rows
      .filter((r) => hasAiReplyConfig(r.settings))
      .map((r) => r.organizationId);
  }
}

export const aiReplyConfigService = new AiReplyConfigService();
