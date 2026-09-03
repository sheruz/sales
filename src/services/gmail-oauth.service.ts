import crypto from "crypto";
import { env } from "@/lib/config/env";
import { encrypt, decrypt } from "@/lib/crypto/encrypt";
import { ValidationError } from "@/lib/api/response";
import { emailAccountService } from "@/services/email-account.service";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

export class GmailOAuthService {
  isConfigured(): boolean {
    return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  }

  getRedirectUri(): string {
    return (
      env.GOOGLE_REDIRECT_URI ??
      `${env.APP_URL}/api/integrations/gmail/callback`
    );
  }

  buildAuthorizeUrl(organizationId: string, userId: string): string {
    if (!this.isConfigured()) {
      throw new ValidationError(
        "Gmail OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
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
      client_id: env.GOOGLE_CLIENT_ID!,
      redirect_uri: this.getRedirectUri(),
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
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

    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: this.getRedirectUri(),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      throw new ValidationError(`Gmail token exchange failed: ${await tokenRes.text()}`);
    }
    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    const profileRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileRes.ok) {
      throw new ValidationError("Failed to fetch Google profile");
    }
    const profile = (await profileRes.json()) as {
      email?: string;
      name?: string;
    };
    if (!profile.email) {
      throw new ValidationError("Google account has no email");
    }

    const account = await emailAccountService.upsertOAuthAccount({
      organizationId,
      userId,
      provider: "GMAIL",
      email: profile.email,
      displayName: profile.name,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    });

    return { account, organizationId, userId };
  }

  async refreshAccessToken(refreshToken: string) {
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!tokenRes.ok) {
      throw new Error(`Gmail refresh failed: ${await tokenRes.text()}`);
    }
    return (await tokenRes.json()) as {
      access_token: string;
      expires_in: number;
    };
  }
}

export const gmailOAuthService = new GmailOAuthService();
