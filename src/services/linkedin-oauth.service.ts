import prisma from "@/lib/db/prisma";
import { IntegrationPlatform, LinkedInConnectionType } from "@prisma/client";
import { env } from "@/lib/config/env";
import { encrypt, decrypt } from "@/lib/crypto/encrypt";
import { ValidationError } from "@/lib/api/response";
import crypto from "crypto";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

export class LinkedInOAuthService {
  isConfigured(): boolean {
    return Boolean(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET);
  }

  getRedirectUri(): string {
    return env.LINKEDIN_REDIRECT_URI ?? `${env.APP_URL}/api/integrations/linkedin/callback`;
  }

  buildAuthorizeUrl(organizationId: string, userId: string): string {
    if (!this.isConfigured()) {
      throw new ValidationError(
        "LinkedIn OAuth is not configured on the server. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET."
      );
    }

    const state = encrypt(
      JSON.stringify({
        organizationId,
        userId,
        nonce: crypto.randomBytes(16).toString("hex"),
      })
    );

    const params = new URLSearchParams({
      response_type: "code",
      client_id: env.LINKEDIN_CLIENT_ID!,
      redirect_uri: this.getRedirectUri(),
      state,
      scope: "openid profile email",
    });

    return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, state: string) {
    let userId: string;
    let organizationId: string;
    try {
      const parsed = JSON.parse(decrypt(state)) as {
        userId: string;
        organizationId: string;
      };
      userId = parsed.userId;
      organizationId = parsed.organizationId;
      if (!userId || !organizationId) throw new Error("missing ids");
    } catch {
      throw new ValidationError("Invalid OAuth state");
    }

    const tokenRes = await fetch(LINKEDIN_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.getRedirectUri(),
        client_id: env.LINKEDIN_CLIENT_ID!,
        client_secret: env.LINKEDIN_CLIENT_SECRET!,
      }),
    });

    if (!tokenRes.ok) {
      throw new ValidationError(`LinkedIn token exchange failed: ${await tokenRes.text()}`);
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    const profileRes = await fetch(LINKEDIN_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      throw new ValidationError("Failed to fetch LinkedIn profile");
    }

    const profile = (await profileRes.json()) as {
      sub: string;
      name?: string;
      email?: string;
    };

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    await prisma.linkedInAccount.upsert({
      where: { userId },
      create: {
        userId,
        connectionType: LinkedInConnectionType.OAUTH,
        linkedInEmail: profile.email,
        displayName: profile.name,
        linkedInMemberId: profile.sub,
        oauthAccessToken: encrypt(tokenData.access_token),
        oauthRefreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        oauthExpiresAt: expiresAt,
        isActive: true,
        lastVerifiedAt: new Date(),
      },
      update: {
        connectionType: LinkedInConnectionType.OAUTH,
        linkedInEmail: profile.email,
        displayName: profile.name,
        linkedInMemberId: profile.sub,
        oauthAccessToken: encrypt(tokenData.access_token),
        oauthRefreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        oauthExpiresAt: expiresAt,
        isActive: true,
        lastVerifiedAt: new Date(),
      },
    });

    const product = await prisma.integrationProduct.findUnique({
      where: { platform: IntegrationPlatform.LINKEDIN },
    });

    await prisma.userIntegration.upsert({
      where: {
        organizationId_userId_platform: {
          organizationId,
          userId,
          platform: IntegrationPlatform.LINKEDIN,
        },
      },
      create: {
        organizationId,
        userId,
        platform: IntegrationPlatform.LINKEDIN,
        productId: product?.id,
        isConnected: true,
        isEnabled: true,
        displayLabel: profile.name ?? profile.email ?? "LinkedIn",
        publicConfig: { memberId: profile.sub, email: profile.email },
        lastVerifiedAt: new Date(),
        lastError: null,
      },
      update: {
        isConnected: true,
        isEnabled: true,
        displayLabel: profile.name ?? profile.email ?? "LinkedIn",
        publicConfig: { memberId: profile.sub, email: profile.email },
        lastVerifiedAt: new Date(),
        lastError: null,
      },
    });

    return { userId, profile };
  }
}

export const linkedInOAuthService = new LinkedInOAuthService();
