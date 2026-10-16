import { IntegrationPlatform } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { decryptCredentials } from "@/lib/integrations/credentials";
import {
  canUsePlatformProviderKeys,
  platformKeyMissingMessage,
} from "@/lib/integrations/platform-keys";
import { ValidationError } from "@/lib/api/response";
import { HunterAdapter } from "@/lib/enrichment/adapters/hunter.adapter";
import type { EnrichmentProvider } from "@/lib/enrichment/types";

export class HunterService {
  async resolveApiKey(organizationId: string, userId?: string): Promise<string> {
    const ti = await prisma.tenantIntegration.findFirst({
      where: {
        organizationId,
        providerId: "hunter",
        status: "CONNECTED",
        encryptedCredentials: { not: null },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (ti?.encryptedCredentials) {
      const creds = decryptCredentials(ti.encryptedCredentials) as {
        apiKey?: string;
      };
      if (creds.apiKey) return creds.apiKey;
    }

    if (userId) {
      const mine = await prisma.userIntegration.findFirst({
        where: {
          organizationId,
          userId,
          platform: IntegrationPlatform.HUNTER,
          isConnected: true,
          isEnabled: true,
        },
        select: { encryptedCredentials: true },
      });
      if (mine?.encryptedCredentials) {
        const creds = decryptCredentials(mine.encryptedCredentials) as {
          apiKey?: string;
        };
        if (creds.apiKey) return creds.apiKey;
      }
    }

    const any = await prisma.userIntegration.findFirst({
      where: {
        organizationId,
        platform: IntegrationPlatform.HUNTER,
        isConnected: true,
        isEnabled: true,
      },
      select: { encryptedCredentials: true },
      orderBy: { updatedAt: "desc" },
    });
    if (any?.encryptedCredentials) {
      const creds = decryptCredentials(any.encryptedCredentials) as {
        apiKey?: string;
      };
      if (creds.apiKey) return creds.apiKey;
    }

    if (canUsePlatformProviderKeys(organizationId) && env.HUNTER_API_KEY) {
      return env.HUNTER_API_KEY;
    }

    throw new ValidationError(platformKeyMissingMessage("Hunter"));
  }

  async getProvider(
    organizationId: string,
    userId?: string
  ): Promise<EnrichmentProvider> {
    const key = await this.resolveApiKey(organizationId, userId);
    return new HunterAdapter(key);
  }
}

export const hunterService = new HunterService();
