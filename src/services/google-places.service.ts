import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { IntegrationPlatform } from "@prisma/client";
import { decryptCredentials } from "@/lib/integrations/credentials";
import {
  canUsePlatformProviderKeys,
  platformKeyMissingMessage,
} from "@/lib/integrations/platform-keys";
import {
  googlePlacesAdapter,
  type GooglePlaceResult,
} from "@/lib/sourcing/adapters/google-places.adapter";
import { apiUsageLogService } from "@/services/api-usage-log.service";
import { ValidationError } from "@/lib/api/response";

export class GooglePlacesService {
  async resolveApiKey(
    organizationId: string,
    userId?: string
  ): Promise<string> {
    // TenantIntegration first (S1), then legacy UserIntegration
    const ti = await prisma.tenantIntegration.findFirst({
      where: {
        organizationId,
        providerId: "google_places",
        status: "CONNECTED",
        encryptedCredentials: { not: null },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (ti?.encryptedCredentials) {
      const creds = decryptCredentials(ti.encryptedCredentials);
      if (creds.apiKey) return creds.apiKey;
    }

    if (userId) {
      const row = await prisma.userIntegration.findUnique({
        where: {
          organizationId_userId_platform: {
            organizationId,
            userId,
            platform: IntegrationPlatform.GOOGLE_PLACES,
          },
        },
      });
      if (row?.isConnected && row.encryptedCredentials) {
        const creds = decryptCredentials(row.encryptedCredentials);
        if (creds.apiKey) return creds.apiKey;
      }
    }

    const anyOrg = await prisma.userIntegration.findFirst({
      where: {
        organizationId,
        platform: IntegrationPlatform.GOOGLE_PLACES,
        isConnected: true,
        encryptedCredentials: { not: null },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (anyOrg?.encryptedCredentials) {
      const creds = decryptCredentials(anyOrg.encryptedCredentials);
      if (creds.apiKey) return creds.apiKey;
    }

    // Platform .env keys: Default Workspace (PLATFORM_OWNER_ORG_ID) only
    if (canUsePlatformProviderKeys(organizationId) && env.GOOGLE_PLACES_API_KEY) {
      return env.GOOGLE_PLACES_API_KEY;
    }
    throw new ValidationError(platformKeyMissingMessage("Google Places"));
  }

  async textSearch(input: {
    organizationId: string;
    userId?: string;
    textQuery: string;
    pageToken?: string | null;
  }): Promise<{
    places: GooglePlaceResult[];
    nextPageToken: string | null;
    estimatedCostUsd: number;
  }> {
    const apiKey = await this.resolveApiKey(
      input.organizationId,
      input.userId
    );
    const result = await googlePlacesAdapter.textSearch({
      apiKey,
      textQuery: input.textQuery,
      pageToken: input.pageToken,
    });
    const estimatedCostUsd = await apiUsageLogService.logGoogleTextSearch(
      input.organizationId,
      {
        query: input.textQuery,
        results: result.places.length,
        hasNextPage: Boolean(result.nextPageToken),
      }
    );
    return {
      places: result.places,
      nextPageToken: result.nextPageToken,
      estimatedCostUsd,
    };
  }
}

export const googlePlacesService = new GooglePlacesService();
