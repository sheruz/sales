import prisma from "@/lib/db/prisma";
import { IntegrationPlatform } from "@prisma/client";
import { decryptCredentials } from "@/lib/integrations/credentials";
import {
  canUsePlatformProviderKeys,
  platformKeyMissingMessage,
} from "@/lib/integrations/platform-keys";
import { getProvider } from "@/lib/integrations/provider-catalog";
import { env } from "@/lib/config/env";
import { ValidationError } from "@/lib/api/response";

export type ResolvedIntegration = {
  providerId: string;
  source: "tenant_integration" | "legacy_user_integration" | "platform_env";
  credentials: Record<string, unknown>;
  status: string;
  externalKey: string;
  managedModeEnabled: boolean;
};

const LEGACY_PLATFORM: Record<string, IntegrationPlatform> = {
  anthropic: IntegrationPlatform.ANTHROPIC,
  openai: IntegrationPlatform.OPENAI,
  google_places: IntegrationPlatform.GOOGLE_PLACES,
  hunter: IntegrationPlatform.HUNTER,
  linkedin: IntegrationPlatform.LINKEDIN,
  smtp: IntegrationPlatform.EMAIL_SMTP,
};

/** Never include these keys in API responses. */
const SECRET_KEYS = new Set([
  "encryptedCredentials",
  "encrypted_credentials",
  "apiKey",
  "api_key",
  "password",
  "smtpPassword",
  "accessToken",
  "refreshToken",
  "oauthAccessToken",
  "oauthRefreshToken",
  "liAtCookie",
  "jsessionId",
  "token",
  "secret",
  "clientSecret",
]);

export function sanitizeIntegrationResponse<T extends Record<string, unknown>>(
  row: T
): Omit<T, never> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (SECRET_KEYS.has(k)) continue;
    if (typeof v === "string" && /^(sk-|sk-ant-|GOCSPX-|ya29\.|AQ\.)/i.test(v)) {
      continue;
    }
    out[k] = v;
  }
  return out as T;
}

export class IntegrationService {
  /**
   * Resolve credentials: TenantIntegration → legacy UserIntegration →
   * platform .env only if organizationId === PLATFORM_OWNER_ORG_ID.
   */
  async get(
    organizationId: string,
    providerId: string,
    opts?: { userId?: string; externalKey?: string }
  ): Promise<ResolvedIntegration> {
    const catalog = getProvider(providerId);
    const externalKey = opts?.externalKey ?? "default";

    const ti = await prisma.tenantIntegration.findUnique({
      where: {
        organizationId_providerId_externalKey: {
          organizationId,
          providerId,
          externalKey,
        },
      },
    });
    if (ti?.status === "CONNECTED" && ti.encryptedCredentials) {
      return {
        providerId,
        source: "tenant_integration",
        credentials: decryptCredentials(ti.encryptedCredentials) as Record<
          string,
          unknown
        >,
        status: ti.status,
        externalKey,
        managedModeEnabled: ti.managedModeEnabled,
      };
    }

    const legacy = LEGACY_PLATFORM[providerId];
    if (legacy) {
      const where = {
        organizationId,
        platform: legacy,
        isConnected: true,
        ...(opts?.userId ? { userId: opts.userId } : {}),
      };
      const ui = await prisma.userIntegration.findFirst({
        where,
        orderBy: { updatedAt: "desc" },
      });
      if (ui?.encryptedCredentials) {
        return {
          providerId,
          source: "legacy_user_integration",
          credentials: decryptCredentials(ui.encryptedCredentials) as Record<
            string,
            unknown
          >,
          status: "CONNECTED",
          externalKey,
          managedModeEnabled: false,
        };
      }
    }

    if (canUsePlatformProviderKeys(organizationId)) {
      const envKey = this.platformEnvKey(providerId);
      if (envKey) {
        return {
          providerId,
          source: "platform_env",
          credentials: { apiKey: envKey },
          status: "CONNECTED",
          externalKey: "platform",
          managedModeEnabled: false,
        };
      }
    }

    throw new ValidationError(
      platformKeyMissingMessage(catalog?.name ?? providerId)
    );
  }

  private platformEnvKey(providerId: string): string | null {
    switch (providerId) {
      case "anthropic":
        return env.ANTHROPIC_API_KEY?.trim() || null;
      case "openai":
        return env.OPENAI_API_KEY?.trim() || null;
      case "google_places":
      case "pagespeed":
        return env.GOOGLE_PLACES_API_KEY?.trim() || null;
      case "hunter":
        return env.HUNTER_API_KEY?.trim() || null;
      default:
        return null;
    }
  }

  /** Public status for Settings UI — never secrets. */
  async listStatus(organizationId: string) {
    const rows = await prisma.tenantIntegration.findMany({
      where: { organizationId },
      select: {
        providerId: true,
        externalKey: true,
        status: true,
        label: true,
        managedModeEnabled: true,
        lastHealthOk: true,
        lastError: true,
        tokenExpiresAt: true,
        oauthMode: true,
        keyMode: true,
      },
    });
    return rows.map((r) => sanitizeIntegrationResponse({ ...r }));
  }
}

export const integrationService = new IntegrationService();
