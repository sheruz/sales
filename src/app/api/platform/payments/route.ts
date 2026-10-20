import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requirePlatformRead,
  requireSuperAdminWrite,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { env } from "@/lib/config/env";
import {
  paymentConfigService,
  ALL_CHECKOUT_METHODS,
  type CheckoutMethodId,
  type ProviderMode,
} from "@/services/billing/payment-config.service";
import { getProvider } from "@/services/billing/provider-registry";
import {
  syncAllPublishedPackages,
  syncProductAndPrices,
} from "@/services/billing/provider-registry";
import { webhookProcessorService } from "@/services/billing/webhook-processor.service";
import prisma from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    await requirePlatformRead();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    const [settings, providers, last, failed, unmatched] = await Promise.all([
      paymentConfigService.getSettings(),
      paymentConfigService.listProvidersForAdmin(),
      prisma.billingWebhookEvent.findFirst({
        orderBy: { createdAt: "desc" },
      }),
      prisma.billingWebhookEvent.findMany({
        where: { status: "error" },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.billingWebhookEvent.findMany({
        where: {
          status: "unmatched",
          ...(q
            ? {
                OR: [
                  { error: { contains: q, mode: "insensitive" } },
                  { eventType: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    let unmatchedEnriched = unmatched;
    if (q) {
      const orgs = await prisma.organization.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true },
        take: 20,
      });
      const orgIds = new Set(orgs.map((o) => o.id));
      const byOrg = await prisma.billingWebhookEvent.findMany({
        where: {
          status: "unmatched",
          organizationId: { in: [...orgIds] },
        },
        take: 50,
      });
      const map = new Map(unmatched.map((w) => [w.id, w]));
      for (const w of byOrg) map.set(w.id, w);
      unmatchedEnriched = [...map.values()];
    }

    const appUrl = env.APP_URL.replace(/\/$/, "");
    return NextResponse.json(
      apiSuccess({
        emergencyDisable: paymentConfigService.isEmergencyDisabled(),
        paymentsEnabled: settings.paymentsEnabled,
        effectivePaymentsLive: await paymentConfigService.isPaymentsLive(),
        statusPill: paymentConfigService.isEmergencyDisabled()
          ? "Off (emergency)"
          : !settings.paymentsEnabled
            ? "Off"
            : providers.some((p) => p.enabled && p.mode === "LIVE")
              ? "LIVE"
              : "Sandbox",
        settings: {
          paymentsEnabled: settings.paymentsEnabled,
          defaultProvider: settings.defaultProvider,
          checkoutMethods: settings.checkoutMethods as CheckoutMethodId[],
          currency: settings.currency,
          graceDays: settings.graceDays,
          manualRenewalLeadDays: settings.manualRenewalLeadDays,
          business: settings.business,
          manualInstructions: settings.manualInstructions,
          sellerAdminEmails: Array.isArray(settings.sellerAdminEmails)
            ? (settings.sellerAdminEmails as string[])
            : [],
        },
        allCheckoutMethods: ALL_CHECKOUT_METHODS,
        providers: providers.map((p) => ({
          ...p,
          webhookUrl: p.webhookPath ? `${appUrl}${p.webhookPath}` : null,
        })),
        lastWebhook: last,
        failedWebhooks: failed,
        unmatchedWebhooks: unmatchedEnriched,
        canImportEnv: Boolean(
          env.PADDLE_API_KEY ||
            env.STRIPE_SECRET_KEY ||
            env.PAYMENTS_ENABLED
        ),
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

const settingsSchema = z.object({
  action: z.literal("update_settings"),
  paymentsEnabled: z.boolean().optional(),
  defaultProvider: z.string().optional(),
  checkoutMethods: z.array(z.string()).optional(),
  currency: z.string().optional(),
  graceDays: z.number().int().min(0).max(90).optional(),
  manualRenewalLeadDays: z.number().int().min(0).max(90).optional(),
  business: z.record(z.string(), z.string()).optional(),
  manualInstructions: z.record(z.string(), z.string()).optional(),
  sellerAdminEmails: z.array(z.string().email()).optional(),
  password: z.string().optional(),
  reason: z.string().min(1),
});

const providerSchema = z.object({
  action: z.literal("update_provider"),
  provider: z.string(),
  enabled: z.boolean().optional(),
  mode: z.enum(["SANDBOX", "LIVE"]).optional(),
  displayName: z.string().optional(),
  credentials: z.record(z.string(), z.string()).optional(),
  credentialsMode: z.enum(["SANDBOX", "LIVE"]).optional(),
  password: z.string().min(1),
  reason: z.string().min(1),
});

export async function PUT(request: NextRequest) {
  try {
    const actor = await requireSuperAdminWrite();
    const body = await request.json();
    if (body.action === "update_settings") {
      const parsed = settingsSchema.parse(body);
      const { action: _a, ...rest } = parsed;
      const updated = await paymentConfigService.updateSettings(
        {
          ...rest,
          checkoutMethods: rest.checkoutMethods as
            | CheckoutMethodId[]
            | undefined,
        },
        actor.id
      );
      return NextResponse.json(apiSuccess({ settings: updated }));
    }
    if (body.action === "update_provider") {
      const parsed = providerSchema.parse(body);
      const { action: _a, ...rest } = parsed;
      const updated = await paymentConfigService.updateProvider(
        {
          ...rest,
          mode: rest.mode as ProviderMode | undefined,
          credentialsMode: rest.credentialsMode as ProviderMode | undefined,
        },
        actor.id
      );
      return NextResponse.json(
        apiSuccess({
          provider: updated.provider,
          enabled: updated.enabled,
          mode: updated.mode,
        })
      );
    }
    return NextResponse.json(apiSuccess({ ok: false }));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperAdminWrite();
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      provider?: string;
      eventId?: string;
      organizationId?: string;
      password?: string;
      reason?: string;
      planVersionId?: string;
      planId?: string;
    };

    if (body.action === "test_connection" && body.provider) {
      const provider = getProvider(body.provider);
      const result = await provider.testConnection();
      await paymentConfigService.recordTestResult(body.provider, result);
      return NextResponse.json(apiSuccess(result));
    }

    if (body.action === "import_env") {
      if (!body.password) {
        return NextResponse.json(
          apiSuccess({ ok: false, message: "Password required" }),
          { status: 400 }
        );
      }
      const result = await paymentConfigService.importFromEnv(
        actor.id,
        body.password,
        body.reason || "Import from .env"
      );
      return NextResponse.json(apiSuccess(result));
    }

    if (body.action === "sync_all") {
      const result = await syncAllPublishedPackages(
        body.provider
          ? { providers: [body.provider as "PADDLE" | "STRIPE"] }
          : undefined
      );
      return NextResponse.json(apiSuccess(result));
    }

    if (
      body.action === "sync_plan" &&
      body.planId &&
      body.planVersionId
    ) {
      const result = await syncProductAndPrices({
        planId: body.planId,
        planVersionId: body.planVersionId,
        providers: body.provider
          ? [body.provider as "PADDLE" | "STRIPE"]
          : undefined,
      });
      return NextResponse.json(apiSuccess(result));
    }

    if (body.action === "retry_webhook" && body.eventId) {
      await webhookProcessorService.processEventById(body.eventId);
      return NextResponse.json(apiSuccess({ ok: true }));
    }

    if (
      body.action === "link_unmatched" &&
      body.eventId &&
      body.organizationId
    ) {
      const result = await webhookProcessorService.linkUnmatched(
        body.eventId,
        body.organizationId
      );
      return NextResponse.json(apiSuccess(result));
    }

    if (body.action === "search_orgs") {
      const q = (body as { q?: string }).q?.trim() || "";
      const orgs = await prisma.organization.findMany({
        where: {
          deletedAt: null,
          ...(env.PLATFORM_OWNER_ORG_ID
            ? { id: { not: env.PLATFORM_OWNER_ORG_ID } }
            : {}),
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { slug: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        select: { id: true, name: true, slug: true },
        take: 20,
        orderBy: { name: "asc" },
      });
      return NextResponse.json(apiSuccess({ orgs }));
    }

    return NextResponse.json(apiSuccess({ ok: false }));
  } catch (error) {
    return handleApiError(error);
  }
}
