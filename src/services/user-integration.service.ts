import prisma from "@/lib/db/prisma";
import { IntegrationPlatform } from "@prisma/client";
import { ValidationError } from "@/lib/api/response";
import {
  decryptCredentials,
  encryptCredentials,
  maskSecret,
} from "@/lib/integrations/credentials";
import { INTEGRATION_CATALOG } from "@/lib/integrations/catalog";
import { getOrCreateOutreachSettings } from "@/lib/ai/resolve-config";
import { OpenAIProvider } from "@/lib/ai/openai";
import { AnthropicProvider } from "@/lib/ai/anthropic";
import { sendEmailWithConfig, type SmtpConfig } from "@/lib/email/send-mail";

export class UserIntegrationService {
  async ensureProductsSeeded() {
    for (const item of INTEGRATION_CATALOG) {
      await prisma.integrationProduct.upsert({
        where: { platform: item.platform },
        create: {
          platform: item.platform,
          name: item.name,
          description: item.description,
          monthlyPriceCents: item.monthlyPriceCents,
          sortOrder: item.sortOrder,
        },
        update: {
          name: item.name,
          description: item.description,
          monthlyPriceCents: item.monthlyPriceCents,
          sortOrder: item.sortOrder,
        },
      });
    }
  }

  async listForUser(organizationId: string, userId: string) {
    await this.ensureProductsSeeded();

    const [products, integrations, outreachSettings] = await Promise.all([
      prisma.integrationProduct.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.userIntegration.findMany({ where: { organizationId, userId } }),
      getOrCreateOutreachSettings(userId),
    ]);

    const integrationMap = new Map(integrations.map((i) => [i.platform, i]));

    return {
      outreachSettings,
      integrations: products.map((product) => {
        const userInt = integrationMap.get(product.platform);
        const catalog = INTEGRATION_CATALOG.find((c) => c.platform === product.platform);
        return {
          platform: product.platform,
          name: product.name,
          description: product.description,
          monthlyPriceCents: product.monthlyPriceCents,
          monthlyPriceLabel:
            product.monthlyPriceCents === 0
              ? "Bring your own key"
              : `$${(product.monthlyPriceCents / 100).toFixed(0)}/mo`,
          fields: catalog?.fields ?? [],
          isConnected: userInt?.isConnected ?? false,
          isEnabled: userInt?.isEnabled ?? false,
          displayLabel: userInt?.displayLabel,
          lastVerifiedAt: userInt?.lastVerifiedAt,
          lastError: userInt?.lastError,
          publicConfig: userInt?.publicConfig,
          maskedPreview: this.buildMaskedPreview(userInt),
        };
      }),
    };
  }

  private buildMaskedPreview(
    integration: {
      platform: IntegrationPlatform;
      encryptedCredentials: string | null;
      publicConfig: unknown;
      displayLabel: string | null;
    } | undefined
  ) {
    if (!integration) return null;

    try {
      if (integration.platform === IntegrationPlatform.EMAIL_SMTP) {
        const cfg = integration.publicConfig as { fromEmail?: string } | null;
        return cfg?.fromEmail ?? integration.displayLabel;
      }
      if (integration.encryptedCredentials) {
        const creds = decryptCredentials(integration.encryptedCredentials);
        if (creds.apiKey) return maskSecret(creds.apiKey);
      }
      return integration.displayLabel;
    } catch {
      return integration.displayLabel;
    }
  }

  async saveOpenAi(organizationId: string, userId: string, apiKey: string) {
    await this.verifyOpenAiKey(apiKey);
    return this.saveCredentials(
      organizationId,
      userId,
      IntegrationPlatform.OPENAI,
      { apiKey },
      "OpenAI connected"
    );
  }

  async saveAnthropic(organizationId: string, userId: string, apiKey: string) {
    await this.verifyAnthropicKey(apiKey);
    return this.saveCredentials(
      organizationId,
      userId,
      IntegrationPlatform.ANTHROPIC,
      { apiKey },
      "Claude connected"
    );
  }

  async saveEmailSmtp(
    organizationId: string,
    userId: string,
    data: {
      smtpHost: string;
      smtpPort: number;
      smtpSecure?: boolean;
      smtpUser: string;
      smtpPassword: string;
      fromName?: string;
      fromEmail: string;
    }
  ) {
    const config: SmtpConfig = {
      host: data.smtpHost,
      port: data.smtpPort,
      secure: data.smtpSecure ?? false,
      user: data.smtpUser,
      password: data.smtpPassword,
      fromName: data.fromName ?? "Sales Platform",
      fromEmail: data.fromEmail,
    };

    await sendEmailWithConfig(config, {
      to: data.fromEmail,
      subject: "Sales Platform — SMTP test",
      text: "Your email integration is configured correctly.",
    });

    const product = await prisma.integrationProduct.findUnique({
      where: { platform: IntegrationPlatform.EMAIL_SMTP },
    });

    return prisma.userIntegration.upsert({
      where: {
        organizationId_userId_platform: {
          organizationId,
          userId,
          platform: IntegrationPlatform.EMAIL_SMTP,
        },
      },
      create: {
        organizationId,
        userId,
        platform: IntegrationPlatform.EMAIL_SMTP,
        productId: product?.id,
        isConnected: true,
        isEnabled: true,
        encryptedCredentials: encryptCredentials({
          smtpPassword: data.smtpPassword,
        }),
        publicConfig: {
          smtpHost: data.smtpHost,
          smtpPort: data.smtpPort,
          smtpSecure: data.smtpSecure ?? false,
          smtpUser: data.smtpUser,
          fromName: data.fromName ?? "Sales Platform",
          fromEmail: data.fromEmail,
        },
        displayLabel: data.fromEmail,
        lastVerifiedAt: new Date(),
        lastError: null,
      },
      update: {
        isConnected: true,
        isEnabled: true,
        encryptedCredentials: encryptCredentials({
          smtpPassword: data.smtpPassword,
        }),
        publicConfig: {
          smtpHost: data.smtpHost,
          smtpPort: data.smtpPort,
          smtpSecure: data.smtpSecure ?? false,
          smtpUser: data.smtpUser,
          fromName: data.fromName ?? "Sales Platform",
          fromEmail: data.fromEmail,
        },
        displayLabel: data.fromEmail,
        lastVerifiedAt: new Date(),
        lastError: null,
      },
    });
  }

  async getEmailConfig(
    organizationId: string,
    userId: string
  ): Promise<SmtpConfig | null> {
    const integration = await prisma.userIntegration.findUnique({
      where: {
        organizationId_userId_platform: {
          organizationId,
          userId,
          platform: IntegrationPlatform.EMAIL_SMTP,
        },
      },
    });

    if (!integration?.isConnected || !integration.encryptedCredentials) return null;

    const secrets = decryptCredentials(integration.encryptedCredentials);
    const pub = integration.publicConfig as {
      smtpHost: string;
      smtpPort: number;
      smtpSecure?: boolean;
      smtpUser: string;
      fromName?: string;
      fromEmail: string;
    };

    return {
      host: pub.smtpHost,
      port: pub.smtpPort,
      secure: pub.smtpSecure ?? false,
      user: pub.smtpUser,
      password: secrets.smtpPassword,
      fromName: pub.fromName ?? "Sales Platform",
      fromEmail: pub.fromEmail,
    };
  }

  async isEmailConfigured(organizationId: string, userId: string): Promise<boolean> {
    const cfg = await this.getEmailConfig(organizationId, userId);
    return Boolean(cfg);
  }

  async updateOutreachSettings(
    organizationId: string,
    userId: string,
    data: {
      activeAiProvider?: IntegrationPlatform;
      economyModel?: string;
      qualityModel?: string;
      enabledChannels?: string[];
      discoveryMode?: string;
    }
  ) {
    void organizationId;
    await getOrCreateOutreachSettings(userId);
    return prisma.userOutreachSettings.update({
      where: { userId },
      data: {
        ...(data.activeAiProvider ? { activeAiProvider: data.activeAiProvider } : {}),
        ...(data.economyModel ? { economyModel: data.economyModel } : {}),
        ...(data.qualityModel ? { qualityModel: data.qualityModel } : {}),
        ...(data.enabledChannels ? { enabledChannels: data.enabledChannels } : {}),
        ...(data.discoveryMode ? { discoveryMode: data.discoveryMode } : {}),
      },
    });
  }

  async disconnect(
    organizationId: string,
    userId: string,
    platform: IntegrationPlatform
  ) {
    await prisma.userIntegration.updateMany({
      where: { organizationId, userId, platform },
      data: {
        isConnected: false,
        isEnabled: false,
        encryptedCredentials: null,
        lastError: null,
      },
    });

    if (platform === IntegrationPlatform.LINKEDIN) {
      const { linkedInAccountService } = await import("@/services/linkedin-account.service");
      await linkedInAccountService.disconnect(userId);
    }

    return { success: true };
  }

  private async saveCredentials(
    organizationId: string,
    userId: string,
    platform: IntegrationPlatform,
    credentials: Record<string, string>,
    displayLabel: string
  ) {
    const product = await prisma.integrationProduct.findUnique({ where: { platform } });

    return prisma.userIntegration.upsert({
      where: {
        organizationId_userId_platform: { organizationId, userId, platform },
      },
      create: {
        organizationId,
        userId,
        platform,
        productId: product?.id,
        isConnected: true,
        isEnabled: true,
        encryptedCredentials: encryptCredentials(credentials),
        displayLabel,
        lastVerifiedAt: new Date(),
        lastError: null,
      },
      update: {
        isConnected: true,
        isEnabled: true,
        encryptedCredentials: encryptCredentials(credentials),
        displayLabel,
        lastVerifiedAt: new Date(),
        lastError: null,
      },
    });
  }

  private async verifyOpenAiKey(apiKey: string) {
    const provider = new OpenAIProvider();
    try {
      await provider.complete({
        apiKey,
        model: "gpt-4o-mini",
        maxTokens: 16,
        messages: [{ role: "user", content: "Reply OK" }],
      });
    } catch (err) {
      throw new ValidationError(
        `Invalid OpenAI API key: ${err instanceof Error ? err.message : "verification failed"}`
      );
    }
  }

  private async verifyAnthropicKey(apiKey: string) {
    const provider = new AnthropicProvider();
    try {
      await provider.complete({
        apiKey,
        model: "claude-haiku-4-5-20251001",
        maxTokens: 16,
        messages: [{ role: "user", content: "Reply OK" }],
      });
    } catch (err) {
      throw new ValidationError(
        `Invalid Anthropic API key: ${err instanceof Error ? err.message : "verification failed"}`
      );
    }
  }
}

export const userIntegrationService = new UserIntegrationService();
