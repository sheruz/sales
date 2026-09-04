import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash, timingSafeEqual } from "crypto";
import prisma from "@/lib/db/prisma";
import { sourceConnectorService } from "@/services/source-connector.service";
import { decryptCredentials } from "@/lib/integrations/credentials";
import { apiSuccess, UnauthorizedError, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { SourceConnectorType } from "@prisma/client";

const eventSchema = z.object({
  companyName: z.string().optional(),
  company_name: z.string().optional(),
  domain: z.string().optional(),
  companyDomain: z.string().optional(),
  page: z.string().optional(),
  pageUrl: z.string().optional(),
  path: z.string().optional(),
  url: z.string().optional(),
  frequency: z.coerce.number().optional(),
  visitCount: z.coerce.number().optional(),
  visits: z.coerce.number().optional(),
  intent: z.string().optional(),
  intentSignal: z.string().optional(),
  visitorId: z.string().optional(),
  sessionId: z.string().optional(),
  externalId: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  confidence: z.coerce.number().optional(),
  occurredAt: z.string().optional(),
  timestamp: z.string().optional(),
});

const bodySchema = z.object({
  connectorId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  events: z.array(eventSchema).min(1).max(100).optional(),
  event: eventSchema.optional(),
});

function safeEqual(a: string, b: string): boolean {
  const ba = createHash("sha256").update(a).digest();
  const bb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ba, bb);
}

/**
 * First-party / licensed website visitor ingest.
 * Auth: x-webhook-secret matching connector credentials.webhookSecret|apiKey
 */
export async function POST(request: NextRequest) {
  try {
    const secret =
      request.headers.get("x-webhook-secret") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";
    if (!secret) throw new UnauthorizedError("Missing webhook secret");

    const body = bodySchema.parse(await request.json());
    const events = body.events ?? (body.event ? [body.event] : []);
    if (!events.length) {
      throw new ValidationError("Provide event or events[]");
    }

    let connector = null;
    if (body.connectorId) {
      connector = await prisma.sourceConnector.findFirst({
        where: {
          id: body.connectorId,
          type: SourceConnectorType.WEBSITE_VISITORS,
        },
      });
    } else if (body.organizationId) {
      connector = await prisma.sourceConnector.findFirst({
        where: {
          organizationId: body.organizationId,
          type: SourceConnectorType.WEBSITE_VISITORS,
          status: { not: "DISABLED" },
        },
        orderBy: { updatedAt: "desc" },
      });
    }

    if (!connector) {
      throw new ValidationError(
        "Website visitor connector not found — create one under Sources"
      );
    }

    const creds = connector.credentialsEncrypted
      ? decryptCredentials(connector.credentialsEncrypted)
      : {};
    const expected = creds.webhookSecret || creds.apiKey || "";
    if (!expected || !safeEqual(secret, expected)) {
      throw new UnauthorizedError("Invalid webhook secret");
    }

    // System user: connector owner is not required; use first org admin session-less run
    const membership = await prisma.organizationUser.findFirst({
      where: {
        organizationId: connector.organizationId,
        status: "ACTIVE",
        isPrimaryAdmin: true,
      },
      select: { userId: true },
    });
    const userId =
      membership?.userId ||
      (
        await prisma.organizationUser.findFirst({
          where: {
            organizationId: connector.organizationId,
            status: "ACTIVE",
          },
          select: { userId: true },
        })
      )?.userId;

    if (!userId) {
      throw new ValidationError("No active user in organization for ingest");
    }

    const result = await sourceConnectorService.run(
      connector.organizationId,
      connector.id,
      userId,
      { events }
    );

    return NextResponse.json(apiSuccess(result), { status: 202 });
  } catch (error) {
    return handleApiError(error);
  }
}
