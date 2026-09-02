import prisma from "@/lib/db/prisma";
import { IntegrationPlatform } from "@prisma/client";
import { env } from "@/lib/config/env";

const QUALITY_FEATURES = new Set([
  "outreach_email",
  "outreach_linkedin",
  "reply_analysis",
]);

export type AiRuntimeConfig = {
  provider: "openai" | "anthropic";
  apiKey: string;
  model: string;
  source: "user" | "platform";
};

export async function resolveAiRuntime(
  userId: string | undefined,
  feature: string
): Promise<AiRuntimeConfig> {
  const tier = QUALITY_FEATURES.has(feature) ? "quality" : "economy";

  if (userId) {
    const [settings, openAi, anthropic] = await Promise.all([
      prisma.userOutreachSettings.findUnique({ where: { userId } }),
      prisma.userIntegration.findUnique({
        where: { userId_platform: { userId, platform: IntegrationPlatform.OPENAI } },
      }),
      prisma.userIntegration.findUnique({
        where: { userId_platform: { userId, platform: IntegrationPlatform.ANTHROPIC } },
      }),
    ]);

    const activeProvider = settings?.activeAiProvider ?? IntegrationPlatform.OPENAI;
    const integration =
      activeProvider === IntegrationPlatform.ANTHROPIC ? anthropic : openAi;

    if (integration?.isConnected && integration.encryptedCredentials) {
      const { decryptCredentials } = await import("@/lib/integrations/credentials");
      const creds = decryptCredentials(integration.encryptedCredentials);
      const apiKey = creds.apiKey;
      if (apiKey) {
        const isAnthropic = activeProvider === IntegrationPlatform.ANTHROPIC;
        const model = tier === "quality"
          ? (settings?.qualityModel ?? (isAnthropic ? env.ANTHROPIC_QUALITY_MODEL : env.OPENAI_QUALITY_MODEL))
          : (settings?.economyModel ?? (isAnthropic ? env.ANTHROPIC_MODEL : env.OPENAI_MODEL));

        return {
          provider: isAnthropic ? "anthropic" : "openai",
          apiKey,
          model,
          source: "user",
        };
      }
    }
  }

  const useAnthropic = env.AI_PROVIDER === "anthropic";
  const apiKey = useAnthropic ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "No AI API key configured. Add your OpenAI or Anthropic key in Settings → Integrations."
    );
  }

  const model = tier === "quality"
    ? (useAnthropic ? env.ANTHROPIC_QUALITY_MODEL : env.OPENAI_QUALITY_MODEL)
    : (useAnthropic ? env.ANTHROPIC_MODEL : env.OPENAI_MODEL);

  return {
    provider: useAnthropic ? "anthropic" : "openai",
    apiKey,
    model,
    source: "platform",
  };
}

export async function getOrCreateOutreachSettings(userId: string) {
  return prisma.userOutreachSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}
