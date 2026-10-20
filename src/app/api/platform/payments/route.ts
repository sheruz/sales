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
  isPaddleConfigured,
  paddleEnvironment,
} from "@/services/billing/paddle-client";
import { paddleProvider } from "@/services/billing/paddle.provider";
import prisma from "@/lib/db/prisma";
import { organizationService } from "@/services/organization.service";

export async function GET() {
  try {
    await requirePlatformRead();
    const webhookUrl = `${env.APP_URL.replace(/\/$/, "")}/api/billing/webhooks/paddle`;
    const last = await prisma.billingWebhookEvent.findFirst({
      orderBy: { createdAt: "desc" },
    });
    const failed = await prisma.billingWebhookEvent.findMany({
      where: { status: { in: ["error", "unmatched"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const settings = await prisma.settings.findUnique({
      where: { key: "platform_billing" },
    });
    return NextResponse.json(
      apiSuccess({
        paymentsEnabled: env.PAYMENTS_ENABLED,
        paddle: {
          configured: isPaddleConfigured(),
          environment: paddleEnvironment(),
          webhookUrl,
          hasApiKey: Boolean(env.PADDLE_API_KEY),
          hasClientToken: Boolean(env.PADDLE_CLIENT_TOKEN),
          hasWebhookSecret: Boolean(env.PADDLE_WEBHOOK_SECRET),
        },
        lastWebhook: last
          ? {
              eventId: last.eventId,
              eventType: last.eventType,
              status: last.status,
              createdAt: last.createdAt,
            }
          : null,
        failedWebhooks: failed,
        business: settings?.value ?? {
          name: "Delvix",
          address: "",
          email: env.BILLING_CONTACT_EMAIL || env.SMTP_FROM_EMAIL || "",
          taxId: "",
        },
        manualInstructions: {
          payoneer:
            (settings?.value as { payoneerInstructions?: string } | null)
              ?.payoneerInstructions || "",
          bank:
            (settings?.value as { bankInstructions?: string } | null)
              ?.bankInstructions || "",
        },
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

const putSchema = z.object({
  businessName: z.string().optional(),
  businessAddress: z.string().optional(),
  businessEmail: z.string().email().optional().or(z.literal("")),
  taxId: z.string().optional(),
  payoneerInstructions: z.string().optional(),
  bankInstructions: z.string().optional(),
  reason: z.string().min(1),
});

export async function PUT(request: NextRequest) {
  try {
    const actor = await requireSuperAdminWrite();
    const body = putSchema.parse(await request.json());
    const before = await prisma.settings.findUnique({
      where: { key: "platform_billing" },
    });
    const value = {
      name: body.businessName ?? "Delvix",
      address: body.businessAddress ?? "",
      email: body.businessEmail ?? "",
      taxId: body.taxId ?? "",
      payoneerInstructions: body.payoneerInstructions ?? "",
      bankInstructions: body.bankInstructions ?? "",
    };
    await prisma.settings.upsert({
      where: { key: "platform_billing" },
      create: { key: "platform_billing", value },
      update: { value },
    });
    await organizationService.writePlatformAudit({
      actorUserId: actor.id,
      action: "payments.settings_updated",
      targetType: "settings",
      targetId: "platform_billing",
      before: before?.value,
      after: value,
      reason: body.reason,
    });
    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdminWrite();
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      eventId?: string;
    };
    if (body.action === "test_connection") {
      const result = await paddleProvider.testConnection();
      return NextResponse.json(apiSuccess(result));
    }
    if (body.action === "retry_webhook" && body.eventId) {
      const { webhookProcessorService } = await import(
        "@/services/billing/webhook-processor.service"
      );
      await webhookProcessorService.processEventById(body.eventId);
      return NextResponse.json(apiSuccess({ ok: true }));
    }
    if (
      body.action === "link_unmatched" &&
      body.eventId &&
      (body as { organizationId?: string }).organizationId
    ) {
      const { webhookProcessorService } = await import(
        "@/services/billing/webhook-processor.service"
      );
      const result = await webhookProcessorService.linkUnmatched(
        body.eventId,
        (body as { organizationId: string }).organizationId
      );
      return NextResponse.json(apiSuccess(result));
    }
    return NextResponse.json(apiSuccess({ ok: false }));
  } catch (error) {
    return handleApiError(error);
  }
}
