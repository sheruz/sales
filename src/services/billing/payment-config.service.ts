/**
 * B3.1: Super Admin–managed payment configuration (DB credentials + settings).
 */

import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import {
  encryptCredentials,
  decryptCredentials,
  maskSecret,
} from "@/lib/integrations/credentials";
import { ValidationError } from "@/lib/api/response";
import { verifyPassword } from "@/lib/auth/password";
import { organizationService } from "@/services/organization.service";
import type { BillingProviderId } from "@/services/billing/provider-types";

export type ProviderMode = "SANDBOX" | "LIVE";
export type PriceMapEnvironment = "sandbox" | "production";

export type CheckoutMethodId =
  | "CARD_PADDLE"
  | "CARD_STRIPE"
  | "INVOICE_PAYONEER"
  | "INVOICE_BANK";

export const ALL_CHECKOUT_METHODS: CheckoutMethodId[] = [
  "CARD_PADDLE",
  "CARD_STRIPE",
  "INVOICE_PAYONEER",
  "INVOICE_BANK",
];

export const PROVIDER_CATALOG: Array<{
  provider: BillingProviderId;
  displayName: string;
  sortOrder: number;
  checkoutMethod: CheckoutMethodId;
  kind: "card" | "invoice";
  credentialKeys: string[];
}> = [
  {
    provider: "PADDLE",
    displayName: "Paddle",
    sortOrder: 10,
    checkoutMethod: "CARD_PADDLE",
    kind: "card",
    credentialKeys: ["apiKey", "clientToken", "webhookSecret"],
  },
  {
    provider: "STRIPE",
    displayName: "Stripe",
    sortOrder: 20,
    checkoutMethod: "CARD_STRIPE",
    kind: "card",
    credentialKeys: ["secretKey", "publishableKey", "webhookSecret"],
  },
  {
    provider: "MANUAL_PAYONEER",
    displayName: "Payoneer (invoice)",
    sortOrder: 30,
    checkoutMethod: "INVOICE_PAYONEER",
    kind: "invoice",
    credentialKeys: [],
  },
  {
    provider: "MANUAL_BANK",
    displayName: "Bank transfer",
    sortOrder: 40,
    checkoutMethod: "INVOICE_BANK",
    kind: "invoice",
    credentialKeys: [],
  },
];

export function modeToEnvironment(mode: ProviderMode): PriceMapEnvironment {
  return mode === "LIVE" ? "production" : "sandbox";
}

export function environmentToMode(envName: string): ProviderMode {
  return envName === "production" || envName === "LIVE" ? "LIVE" : "SANDBOX";
}

function hintFromCreds(creds: Record<string, string>): string | null {
  const primary =
    creds.apiKey ||
    creds.secretKey ||
    creds.clientToken ||
    creds.webhookSecret ||
    Object.values(creds)[0];
  if (!primary) return null;
  const last = primary.slice(-4);
  return `••••${last}`;
}

export class PaymentConfigService {
  isEmergencyDisabled(): boolean {
    return env.PAYMENTS_EMERGENCY_DISABLE === true;
  }

  async ensureDefaults() {
    await prisma.paymentSettings.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
    });
    for (const p of PROVIDER_CATALOG) {
      await prisma.paymentProviderConfig.upsert({
        where: { provider: p.provider },
        create: {
          provider: p.provider,
          displayName: p.displayName,
          sortOrder: p.sortOrder,
          enabled: false,
          mode: "SANDBOX",
        },
        update: {},
      });
    }
  }

  async getSettings() {
    await this.ensureDefaults();
    return prisma.paymentSettings.findUniqueOrThrow({
      where: { id: "default" },
    });
  }

  /** Effective master switch: DB flag AND NOT emergency kill. */
  async isPaymentsLive(): Promise<boolean> {
    if (this.isEmergencyDisabled()) return false;
    const s = await this.getSettings();
    return s.paymentsEnabled;
  }

  async getProviderConfig(provider: string) {
    await this.ensureDefaults();
    return prisma.paymentProviderConfig.findUnique({
      where: { provider },
    });
  }

  async listProviderConfigs() {
    await this.ensureDefaults();
    return prisma.paymentProviderConfig.findMany({
      orderBy: { sortOrder: "asc" },
    });
  }

  /** Public-safe provider list (no secrets). */
  async listProvidersForAdmin() {
    const rows = await this.listProviderConfigs();
    const counts = await prisma.subscription.groupBy({
      by: ["provider"],
      where: {
        status: { in: ["ACTIVE", "PAST_DUE", "TRIALING"] },
        ...(env.PLATFORM_OWNER_ORG_ID
          ? { organizationId: { not: env.PLATFORM_OWNER_ORG_ID } }
          : {}),
      },
      _count: true,
    });
    const countMap = Object.fromEntries(
      counts.map((c) => [c.provider.toUpperCase(), c._count])
    );

    return rows.map((r) => ({
      provider: r.provider,
      enabled: r.enabled,
      mode: r.mode as ProviderMode,
      displayName: r.displayName,
      sortOrder: r.sortOrder,
      configuredSandbox: Boolean(r.sandboxCredentialsEnc),
      configuredLive: Boolean(r.liveCredentialsEnc),
      sandboxHint: r.sandboxHint,
      liveHint: r.liveHint,
      lastTestAt: r.lastTestAt,
      lastTestResult: r.lastTestResult,
      lastWebhookAt: r.lastWebhookAt,
      activeSubscriptions: countMap[r.provider] ?? 0,
      webhookPath:
        r.provider === "PADDLE"
          ? "/api/billing/webhooks/paddle"
          : r.provider === "STRIPE"
            ? "/api/billing/webhooks/stripe"
            : null,
    }));
  }

  getCredentials(
    row: {
      mode: string;
      sandboxCredentialsEnc: string | null;
      liveCredentialsEnc: string | null;
    },
    mode?: ProviderMode
  ): Record<string, string> | null {
    const m = mode || (row.mode as ProviderMode);
    const enc =
      m === "LIVE" ? row.liveCredentialsEnc : row.sandboxCredentialsEnc;
    if (!enc) return null;
    return decryptCredentials(enc);
  }

  async getProviderCredentials(
    provider: string,
    mode?: ProviderMode
  ): Promise<{
    mode: ProviderMode;
    environment: PriceMapEnvironment;
    credentials: Record<string, string>;
  } | null> {
    const row = await this.getProviderConfig(provider);
    if (!row) return null;
    const m = mode || (row.mode as ProviderMode);
    const credentials = this.getCredentials(row, m);
    if (!credentials) return null;
    return {
      mode: m,
      environment: modeToEnvironment(m),
      credentials,
    };
  }

  async requirePassword(actorUserId: string, password: string) {
    const user = await prisma.user.findUnique({ where: { id: actorUserId } });
    if (!user?.passwordHash) {
      throw new ValidationError("Password confirmation required");
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new ValidationError("Incorrect password");
  }

  async updateSettings(
    input: {
      paymentsEnabled?: boolean;
      defaultProvider?: string;
      checkoutMethods?: CheckoutMethodId[];
      currency?: string;
      graceDays?: number;
      manualRenewalLeadDays?: number;
      business?: Record<string, string>;
      manualInstructions?: Record<string, string>;
      password?: string;
      reason: string;
    },
    actorUserId: string
  ) {
    const before = await this.getSettings();
    const risky =
      input.paymentsEnabled !== undefined &&
      input.paymentsEnabled !== before.paymentsEnabled;
    if (risky) {
      if (!input.password) {
        throw new ValidationError("Password confirmation required");
      }
      await this.requirePassword(actorUserId, input.password);
    }

    const updated = await prisma.paymentSettings.update({
      where: { id: "default" },
      data: {
        ...(input.paymentsEnabled !== undefined
          ? { paymentsEnabled: input.paymentsEnabled }
          : {}),
        ...(input.defaultProvider
          ? { defaultProvider: input.defaultProvider }
          : {}),
        ...(input.checkoutMethods
          ? { checkoutMethods: input.checkoutMethods }
          : {}),
        ...(input.currency ? { currency: input.currency } : {}),
        ...(input.graceDays !== undefined
          ? { graceDays: input.graceDays }
          : {}),
        ...(input.manualRenewalLeadDays !== undefined
          ? { manualRenewalLeadDays: input.manualRenewalLeadDays }
          : {}),
        ...(input.business ? { business: input.business } : {}),
        ...(input.manualInstructions
          ? { manualInstructions: input.manualInstructions }
          : {}),
      },
    });

    await organizationService.writePlatformAudit({
      actorUserId,
      action: "payments.settings_updated",
      targetType: "payment_settings",
      targetId: "default",
      before: {
        paymentsEnabled: before.paymentsEnabled,
        defaultProvider: before.defaultProvider,
        checkoutMethods: before.checkoutMethods,
        currency: before.currency,
        graceDays: before.graceDays,
      },
      after: {
        paymentsEnabled: updated.paymentsEnabled,
        defaultProvider: updated.defaultProvider,
        checkoutMethods: updated.checkoutMethods,
        currency: updated.currency,
        graceDays: updated.graceDays,
      },
      reason: input.reason,
    });

    return updated;
  }

  async updateProvider(
    input: {
      provider: string;
      enabled?: boolean;
      mode?: ProviderMode;
      displayName?: string;
      credentials?: Record<string, string>;
      credentialsMode?: ProviderMode;
      password: string;
      reason: string;
    },
    actorUserId: string
  ) {
    await this.requirePassword(actorUserId, input.password);
    const before = await this.getProviderConfig(input.provider);
    if (!before) throw new ValidationError("Unknown provider");

    const data: {
      enabled?: boolean;
      mode?: string;
      displayName?: string;
      sandboxCredentialsEnc?: string;
      liveCredentialsEnc?: string;
      sandboxHint?: string | null;
      liveHint?: string | null;
    } = {};

    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.mode) data.mode = input.mode;
    if (input.displayName) data.displayName = input.displayName;

    if (input.credentials && Object.keys(input.credentials).length > 0) {
      const catalog = PROVIDER_CATALOG.find(
        (p) => p.provider === input.provider
      );
      if (catalog && catalog.credentialKeys.length === 0) {
        throw new ValidationError("This provider has no API credentials");
      }
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(input.credentials)) {
        if (v && !v.includes("••••")) cleaned[k] = v;
      }
      if (Object.keys(cleaned).length > 0) {
        const targetMode =
          input.credentialsMode ||
          input.mode ||
          (before.mode as ProviderMode);
        const enc = encryptCredentials(cleaned);
        const hint = hintFromCreds(cleaned);
        if (targetMode === "LIVE") {
          data.liveCredentialsEnc = enc;
          data.liveHint = hint;
        } else {
          data.sandboxCredentialsEnc = enc;
          data.sandboxHint = hint;
        }
      }
    }

    const updated = await prisma.paymentProviderConfig.update({
      where: { provider: input.provider },
      data,
    });

    await organizationService.writePlatformAudit({
      actorUserId,
      action: "payments.provider_updated",
      targetType: "payment_provider_config",
      targetId: input.provider,
      before: {
        enabled: before.enabled,
        mode: before.mode,
        configuredSandbox: Boolean(before.sandboxCredentialsEnc),
        configuredLive: Boolean(before.liveCredentialsEnc),
      },
      after: {
        enabled: updated.enabled,
        mode: updated.mode,
        configuredSandbox: Boolean(updated.sandboxCredentialsEnc),
        configuredLive: Boolean(updated.liveCredentialsEnc),
        credentialsReplaced: Boolean(input.credentials),
      },
      reason: input.reason,
    });

    return updated;
  }

  async recordTestResult(
    provider: string,
    result: { ok: boolean; message: string }
  ) {
    await prisma.paymentProviderConfig.update({
      where: { provider },
      data: {
        lastTestAt: new Date(),
        lastTestResult: result,
      },
    });
  }

  async touchWebhook(provider: string) {
    await prisma.paymentProviderConfig.update({
      where: { provider },
      data: { lastWebhookAt: new Date() },
    });
  }

  /** One-time import from legacy env vars into SANDBOX (or LIVE if PADDLE_ENV=production). */
  async importFromEnv(actorUserId: string, password: string, reason: string) {
    await this.requirePassword(actorUserId, password);
    await this.ensureDefaults();
    const imported: string[] = [];

    const paddleMode: ProviderMode =
      env.PADDLE_ENV === "production" ? "LIVE" : "SANDBOX";
    if (env.PADDLE_API_KEY || env.PADDLE_CLIENT_TOKEN || env.PADDLE_WEBHOOK_SECRET) {
      await this.updateProvider(
        {
          provider: "PADDLE",
          mode: paddleMode,
          credentialsMode: paddleMode,
          credentials: {
            ...(env.PADDLE_API_KEY ? { apiKey: env.PADDLE_API_KEY } : {}),
            ...(env.PADDLE_CLIENT_TOKEN
              ? { clientToken: env.PADDLE_CLIENT_TOKEN }
              : {}),
            ...(env.PADDLE_WEBHOOK_SECRET
              ? { webhookSecret: env.PADDLE_WEBHOOK_SECRET }
              : {}),
          },
          password,
          reason: reason || "Import from .env",
        },
        actorUserId
      );
      imported.push("PADDLE");
    }

    if (
      env.STRIPE_SECRET_KEY ||
      env.STRIPE_PUBLISHABLE_KEY ||
      env.STRIPE_WEBHOOK_SECRET
    ) {
      const stripeMode: ProviderMode = env.STRIPE_SECRET_KEY?.startsWith("sk_live")
        ? "LIVE"
        : "SANDBOX";
      await this.updateProvider(
        {
          provider: "STRIPE",
          mode: stripeMode,
          credentialsMode: stripeMode,
          credentials: {
            ...(env.STRIPE_SECRET_KEY
              ? { secretKey: env.STRIPE_SECRET_KEY }
              : {}),
            ...(env.STRIPE_PUBLISHABLE_KEY
              ? { publishableKey: env.STRIPE_PUBLISHABLE_KEY }
              : {}),
            ...(env.STRIPE_WEBHOOK_SECRET
              ? { webhookSecret: env.STRIPE_WEBHOOK_SECRET }
              : {}),
          },
          password,
          reason: reason || "Import from .env",
        },
        actorUserId
      );
      imported.push("STRIPE");
    }

    if (env.PAYMENTS_ENABLED) {
      await this.updateSettings(
        {
          paymentsEnabled: true,
          password,
          reason: reason || "Import PAYMENTS_ENABLED from .env",
        },
        actorUserId
      );
      imported.push("paymentsEnabled");
    }

    return { imported, note: "Env values are ignored at runtime after import" };
  }

  async resolveOrgProvider(organizationId: string): Promise<string> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { billingProvider: true },
    });
    if (org?.billingProvider) return org.billingProvider;
    const s = await this.getSettings();
    return s.defaultProvider;
  }

  async resolveCheckoutMethods(
    organizationId: string
  ): Promise<CheckoutMethodId[]> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { allowedCheckoutMethods: true },
    });
    const settings = await this.getSettings();
    const global = (settings.checkoutMethods as CheckoutMethodId[]) || [];
    const orgMethods = org?.allowedCheckoutMethods as
      | CheckoutMethodId[]
      | null
      | undefined;
    const base =
      orgMethods && Array.isArray(orgMethods) && orgMethods.length > 0
        ? orgMethods
        : global;

    const enabled = await this.listProviderConfigs();
    const enabledSet = new Set(
      enabled.filter((e) => e.enabled).map((e) => e.provider)
    );

    return base.filter((m) => {
      const cat = PROVIDER_CATALOG.find((p) => p.checkoutMethod === m);
      return cat ? enabledSet.has(cat.provider) : false;
    });
  }

  /** Redact secrets for logging — never pass raw credentials. */
  static redactForLog(obj: unknown): unknown {
    if (!obj || typeof obj !== "object") return obj;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (
        /secret|key|token|password|credential/i.test(k) &&
        typeof v === "string"
      ) {
        out[k] = maskSecret(v, 2);
      } else {
        out[k] = v;
      }
    }
    return out;
  }
}

export const paymentConfigService = new PaymentConfigService();
