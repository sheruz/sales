import crypto from "crypto";
import { env } from "@/lib/config/env";
import { encrypt, decrypt } from "@/lib/crypto/encrypt";
import { ValidationError } from "@/lib/api/response";
import { emailAccountService } from "@/services/email-account.service";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "offline_access",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/Mail.Read",
  "https://graph.microsoft.com/User.Read",
].join(" ");

export class OutlookOAuthService {
  isConfigured(): boolean {
    return Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET);
  }

  getTenant(): string {
    return env.MICROSOFT_TENANT_ID || "common";
  }

  getRedirectUri(): string {
    return (
      env.MICROSOFT_REDIRECT_URI ??
      `${env.APP_URL}/api/integrations/outlook/callback`
    );
  }

  buildAuthorizeUrl(organizationId: string, userId: string): string {
    if (!this.isConfigured()) {
      throw new ValidationError(
        "Outlook OAuth is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET."
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
      client_id: env.MICROSOFT_CLIENT_ID!,
      response_type: "code",
      redirect_uri: this.getRedirectUri(),
      response_mode: "query",
      scope: SCOPES,
      state,
    });
    return `https://login.microsoftonline.com/${this.getTenant()}/oauth2/v2.0/authorize?${params}`;
  }

  async handleCallback(code: string, state: string) {
    let organizationId: string;
    let userId: string;
    try {
      const parsed = JSON.parse(decrypt(state)) as {
        organizationId: string;
        userId: string;
      };
      organizationId = parsed.organizationId;
      userId = parsed.userId;
      if (!organizationId || !userId) throw new Error("missing");
    } catch {
      throw new ValidationError("Invalid OAuth state");
    }

    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${this.getTenant()}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.MICROSOFT_CLIENT_ID!,
          client_secret: env.MICROSOFT_CLIENT_SECRET!,
          code,
          redirect_uri: this.getRedirectUri(),
          grant_type: "authorization_code",
          scope: SCOPES,
        }),
      }
    );
    if (!tokenRes.ok) {
      throw new ValidationError(
        `Outlook token exchange failed: ${await tokenRes.text()}`
      );
    }
    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileRes.ok) {
      throw new ValidationError("Failed to fetch Microsoft profile");
    }
    const profile = (await profileRes.json()) as {
      mail?: string;
      userPrincipalName?: string;
      displayName?: string;
    };
    const email = profile.mail || profile.userPrincipalName;
    if (!email) throw new ValidationError("Microsoft account has no email");

    const account = await emailAccountService.upsertOAuthAccount({
      organizationId,
      userId,
      provider: "OUTLOOK",
      email,
      displayName: profile.displayName,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    });

    return { account, organizationId, userId };
  }

  async refreshAccessToken(refreshToken: string) {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${this.getTenant()}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.MICROSOFT_CLIENT_ID!,
          client_secret: env.MICROSOFT_CLIENT_SECRET!,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
          scope: SCOPES,
        }),
      }
    );
    if (!tokenRes.ok) {
      throw new Error(`Outlook refresh failed: ${await tokenRes.text()}`);
    }
    return (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
  }
}

export const outlookOAuthService = new OutlookOAuthService();
