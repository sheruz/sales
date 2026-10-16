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

    const [products, integrations, outreachSettings, emailAccounts] =
      await Promise.all([
        prisma.integrationProduct.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        }),
        prisma.userIntegration.findMany({ where: { organizationId, userId } }),
        getOrCreateOutreachSettings(userId),
        prisma.emailAccount.findMany({
          where: { organizationId, userId },
          select: {
            id: true,
            provider: true,
            email: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

    const integrationMap = new Map(integrations.map((i) => [i.platform, i]));
    const productMap = new Map(products.map((p) => [p.platform, p]));

    // Merge DB products with static catalog so new platforms (e.g. GOOGLE_PLACES)
    // appear in Settings even before migrate seeds integration_products.
    const platforms = new Set<IntegrationPlatform>([
      ...products.map((p) => p.platform),
      ...INTEGRATION_CATALOG.map((c) => c.platform as IntegrationPlatform),
    ]);

    const ordered = [...platforms].sort((a, b) => {
      const ca = INTEGRATION_CATALOG.find((c) => c.platform === a);
      const cb = INTEGRATION_CATALOG.find((c) => c.platform === b);
      return (ca?.sortOrder ?? 99) - (cb?.sortOrder ?? 99);
    });

    const activeByProvider = (provider: "GMAIL" | "OUTLOOK" | "SMTP") =>
      emailAccounts.find((a) => a.provider === provider && a.status === "ACTIVE");
    const inactiveByProvider = (provider: "GMAIL" | "OUTLOOK" | "SMTP") =>
      emailAccounts.find((a) => a.provider === provider && a.status !== "ACTIVE");

    return {
      outreachSettings,
      emailAccounts,
      integrations: ordered.map((platform) => {
        const product = productMap.get(platform);
        const catalog = INTEGRATION_CATALOG.find((c) => c.platform === platform);
        const userInt = integrationMap.get(platform);
        const monthlyPriceCents =
          product?.monthlyPriceCents ?? catalog?.monthlyPriceCents ?? 0;

        // Prefer live EmailAccount status for SMTP so UI matches seat counting.
        let isConnected = userInt?.isConnected ?? false;
        let maskedPreview: string | null = this.buildMaskedPreview(
          userInt
            ? {
                ...userInt,
                isConnected: userInt.isConnected,
              }
            : undefined
        );
        let staleAccountId: string | null = null;
        let staleEmail: string | null = null;

        if (platform === IntegrationPlatform.EMAIL_SMTP) {
          const active = activeByProvider("SMTP");
          const inactive = inactiveByProvider("SMTP");
          if (active) {
            isConnected = true;
            maskedPreview = active.email;
          } else {
            isConnected = false;
            maskedPreview = null;
            if (inactive || (userInt && !userInt.isConnected && userInt.publicConfig)) {
              staleAccountId = inactive?.id ?? null;
              staleEmail = inactive?.email ??
                ((userInt?.publicConfig as { fromEmail?: string } | null)?.fromEmail ??
                  userInt?.displayLabel ??
                  null);
            }
          }
        }

        return {
          platform,
          name: product?.name ?? catalog?.name ?? platform,
          description: product?.description ?? catalog?.description ?? "",
          monthlyPriceCents,
          monthlyPriceLabel:
            monthlyPriceCents === 0
              ? "Bring your own key"
              : `$${(monthlyPriceCents / 100).toFixed(0)}/mo`,
          fields: catalog?.fields ?? [],
          isConnected,
          isEnabled: userInt?.isEnabled ?? false,
          displayLabel: userInt?.displayLabel,
          lastVerifiedAt: userInt?.lastVerifiedAt,
          lastError: userInt?.lastError,
          publicConfig: userInt?.publicConfig,
          maskedPreview,
          staleAccountId,
          staleEmail,
        };
      }),
      gmailAccount: activeByProvider("GMAIL") ?? null,
      outlookAccount: activeByProvider("OUTLOOK") ?? null,
      staleGmail: !activeByProvider("GMAIL")
        ? inactiveByProvider("GMAIL") ?? null
        : null,
      staleOutlook: !activeByProvider("OUTLOOK")
        ? inactiveByProvider("OUTLOOK") ?? null
        : null,
    };
  }

  private buildMaskedPreview(
    integration: {
      platform: IntegrationPlatform;
      isConnected?: boolean;
      encryptedCredentials: string | null;
      publicConfig: unknown;
      displayLabel: string | null;
    } | undefined
  ) {
    if (!integration) return null;
    // Never surface "Connected as …" when the integration is disconnected
    if (integration.isConnected === false) return null;

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
    const row = await this.saveCredentials(
      organizationId,
      userId,
      IntegrationPlatform.OPENAI,
      { apiKey },
      "OpenAI connected"
    );
    return this.toPublicIntegration(row);
  }

  async saveAnthropic(organizationId: string, userId: string, apiKey: string) {
    await this.verifyAnthropicKey(apiKey);
    const row = await this.saveCredentials(
      organizationId,
      userId,
      IntegrationPlatform.ANTHROPIC,
      { apiKey },
      "Claude connected"
    );
    return this.toPublicIntegration(row);
  }

  async saveGooglePlaces(
    organizationId: string,
    userId: string,
    apiKey: string
  ) {
    await this.verifyGooglePlacesKey(apiKey);
    const row = await this.saveCredentials(
      organizationId,
      userId,
      IntegrationPlatform.GOOGLE_PLACES,
      { apiKey },
      "Google Places connected"
    );
    return this.toPublicIntegration(row);
  }

  async saveHunter(organizationId: string, userId: string, apiKey: string) {
    await this.verifyHunterKey(apiKey);
    const row = await this.saveCredentials(
      organizationId,
      userId,
      IntegrationPlatform.HUNTER,
      { apiKey },
      "Hunter.io connected"
    );
    return this.toPublicIntegration(row);
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
      fromName: data.fromName ?? "Delvix",
      fromEmail: data.fromEmail,
    };

    await sendEmailWithConfig(config, {
      to: data.fromEmail,
      subject: "Delvix — SMTP test",
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
          fromName: data.fromName ?? "Delvix",
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
          fromName: data.fromName ?? "Delvix",
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
      fromName: pub.fromName ?? "Delvix",
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
        publicConfig: {},
        displayLabel: null,
        lastError: null,
      },
    });

    if (platform === IntegrationPlatform.LINKEDIN) {
      const { linkedInAccountService } = await import("@/services/linkedin-account.service");
      await linkedInAccountService.disconnect(userId);
    }

    return { success: true };
  }

  /** Strip secrets before any API response. */
  toPublicIntegration<T extends { encryptedCredentials?: string | null }>(row: T) {
    const hasCredentials = Boolean(row.encryptedCredentials);
    const { encryptedCredentials: _omit, ...rest } = row;
    return { ...rest, hasCredentials };
  }

  private async saveCredentials(
    organizationId: string,
    userId: string,
    platform: IntegrationPlatform,
    credentials: Record<string, string>,
    displayLabel: string
  ) {
    const product = await prisma.integrationProduct.findUnique({ where: { platform } });
    const encrypted = encryptCredentials(credentials);

    const row = await prisma.userIntegration.upsert({
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
        encryptedCredentials: encrypted,
        displayLabel,
        lastVerifiedAt: new Date(),
        lastError: null,
      },
      update: {
        isConnected: true,
        isEnabled: true,
        encryptedCredentials: encrypted,
        displayLabel,
        lastVerifiedAt: new Date(),
        lastError: null,
      },
    });

    // S1 dual-write TenantIntegration (never drop legacy)
    const providerId = this.platformToProviderId(platform);
    if (providerId) {
      await prisma.tenantIntegration.upsert({
        where: {
          organizationId_providerId_externalKey: {
            organizationId,
            providerId,
            externalKey: "default",
          },
        },
        create: {
          organizationId,
          providerId,
          externalKey: "default",
          label: displayLabel,
          status: "CONNECTED",
          encryptedCredentials: encrypted,
          keyMode: "BYOK",
          managedModeEnabled: false,
          connectedByUserId: userId,
          legacySource: "UserIntegration",
          legacySourceId: row.id,
        },
        update: {
          status: "CONNECTED",
          encryptedCredentials: encrypted,
          label: displayLabel,
          legacySource: "UserIntegration",
          legacySourceId: row.id,
          lastError: null,
        },
      });
    }

    return row;
  }

  private platformToProviderId(platform: IntegrationPlatform): string | null {
    const map: Partial<Record<IntegrationPlatform, string>> = {
      ANTHROPIC: "anthropic",
      OPENAI: "openai",
      GOOGLE_PLACES: "google_places",
      HUNTER: "hunter",
      EMAIL_SMTP: "smtp",
      LINKEDIN: "linkedin",
    };
    return map[platform] ?? null;
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

  private async verifyGooglePlacesKey(apiKey: string) {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.id",
        },
        body: JSON.stringify({ textQuery: "cafe", pageSize: 1 }),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ValidationError(
        `Invalid Google Places API key: ${res.status} ${body.slice(0, 200)}`
      );
    }
  }

  private async verifyHunterKey(apiKey: string) {
    const url = new URL("https://api.hunter.io/v2/account");
    url.searchParams.set("api_key", apiKey);
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ValidationError(
        `Invalid Hunter API key: ${res.status} ${body.slice(0, 200)}`
      );
    }
  }
}

export const userIntegrationService = new UserIntegrationService();
