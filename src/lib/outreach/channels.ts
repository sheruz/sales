import prisma from "@/lib/db/prisma";
import type { OutreachChannel } from "@/lib/outreach/channels";
import { env } from "@/lib/config/env";
import { getOrCreateOutreachSettings } from "@/lib/ai/resolve-config";

export type { OutreachChannel };

export async function getOutreachChannelsForUser(userId?: string): Promise<OutreachChannel[]> {
  if (userId) {
    const settings = await getOrCreateOutreachSettings(userId);
    const channels = settings.enabledChannels
      .map((c) => c.trim().toLowerCase())
      .filter((c): c is OutreachChannel => c === "linkedin" || c === "email");
    if (channels.length > 0) return channels;
  }

  return getDefaultOutreachChannelsFromEnv();
}

export function getDefaultOutreachChannelsFromEnv(): OutreachChannel[] {
  const raw = env.OUTREACH_CHANNELS ?? "email";
  const channels = raw
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c): c is OutreachChannel => c === "linkedin" || c === "email");
  return channels.length > 0 ? channels : ["email"];
}

/** @deprecated prefer getOutreachChannelsForUser */
export function getDefaultOutreachChannels(): OutreachChannel[] {
  return getDefaultOutreachChannelsFromEnv();
}

export async function getDiscoveryModeForUser(userId?: string): Promise<"job_posts" | "linkedin"> {
  if (userId) {
    const settings = await getOrCreateOutreachSettings(userId);
    return settings.discoveryMode === "linkedin" ? "linkedin" : "job_posts";
  }
  return env.AUTOPILOT_DISCOVERY_MODE === "linkedin" ? "linkedin" : "job_posts";
}

export async function isEmailOnlyOutreachForUser(userId?: string): Promise<boolean> {
  const channels = await getOutreachChannelsForUser(userId);
  return channels.length === 1 && channels[0] === "email";
}

export function isLinkedInOutreachEnabled(): boolean {
  return getDefaultOutreachChannelsFromEnv().includes("linkedin");
}

export async function isEmailConfiguredForOutreach(userId?: string): Promise<boolean> {
  const { isEmailConfiguredForUser } = await import("@/lib/email/smtp");
  return isEmailConfiguredForUser(userId);
}
