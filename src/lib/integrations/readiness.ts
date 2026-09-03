import prisma from "@/lib/db/prisma";
import { IntegrationPlatform } from "@prisma/client";
import { userIntegrationService } from "@/services/user-integration.service";
import { getOrCreateOutreachSettings } from "@/lib/ai/resolve-config";

export async function isAiConfigured(
  organizationId: string,
  userId: string
): Promise<boolean> {
  const settings = await getOrCreateOutreachSettings(userId);
  const platform =
    settings.activeAiProvider === IntegrationPlatform.ANTHROPIC
      ? IntegrationPlatform.ANTHROPIC
      : IntegrationPlatform.OPENAI;

  const integration = await prisma.userIntegration.findUnique({
    where: {
      organizationId_userId_platform: { organizationId, userId, platform },
    },
  });

  return Boolean(integration?.isConnected && integration.encryptedCredentials);
}

export async function getUserReadiness(organizationId: string, userId: string) {
  const [ai, email, openAi, anthropic, emailInt, linkedin, services, campaigns, autopilot] =
    await Promise.all([
      isAiConfigured(organizationId, userId),
      userIntegrationService.isEmailConfigured(organizationId, userId),
      prisma.userIntegration.findUnique({
        where: {
          organizationId_userId_platform: {
            organizationId,
            userId,
            platform: IntegrationPlatform.OPENAI,
          },
        },
      }),
      prisma.userIntegration.findUnique({
        where: {
          organizationId_userId_platform: {
            organizationId,
            userId,
            platform: IntegrationPlatform.ANTHROPIC,
          },
        },
      }),
      prisma.userIntegration.findUnique({
        where: {
          organizationId_userId_platform: {
            organizationId,
            userId,
            platform: IntegrationPlatform.EMAIL_SMTP,
          },
        },
      }),
      prisma.userIntegration.findUnique({
        where: {
          organizationId_userId_platform: {
            organizationId,
            userId,
            platform: IntegrationPlatform.LINKEDIN,
          },
        },
      }),
      prisma.service.count({ where: { organizationId, isActive: true } }),
      prisma.campaign.count({ where: { organizationId, deletedAt: null } }),
      prisma.autopilotConfig.findUnique({ where: { userId } }),
    ]);

  const steps = [
    {
      id: "ai",
      label: "Connect AI provider (OpenAI or Claude)",
      done: ai,
      href: "/dashboard/settings?tab=integrations",
    },
    {
      id: "email",
      label: "Connect your business email (SMTP)",
      done: email,
      href: "/dashboard/settings?tab=integrations",
    },
    {
      id: "services",
      label: "Configure at least one company service",
      done: services > 0,
      href: "/dashboard/settings?tab=services",
    },
    {
      id: "campaign",
      label: "Create your first campaign",
      done: campaigns > 0,
      href: "/dashboard/campaigns",
    },
    {
      id: "autopilot",
      label: "Set autopilot goal and enable",
      done: Boolean(autopilot?.isEnabled && autopilot.goal),
      href: "/dashboard/autopilot",
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const readyForAutopilot = ai && email;

  return {
    steps,
    completedCount,
    totalSteps: steps.length,
    percentComplete: Math.round((completedCount / steps.length) * 100),
    readyForAutopilot,
    integrations: {
      openAi: openAi?.isConnected ?? false,
      anthropic: anthropic?.isConnected ?? false,
      email: emailInt?.isConnected ?? false,
      linkedin: linkedin?.isConnected ?? false,
    },
  };
}
