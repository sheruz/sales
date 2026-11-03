import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { EmailEventType } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { resolveEvidencePath } from "@/lib/audit/evidence-store";
import { verifyPowPreviewToken } from "@/lib/pow/preview-token";
import { classifyEmailTraffic } from "@/lib/security/email-bot-filter";

export const dynamic = "force-dynamic";

function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/**
 * Public PoW3 preview — HMAC token only. Never leak org/company in errors.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token: raw } = await context.params;
    const token = decodeURIComponent(raw || "");
    const payload = verifyPowPreviewToken(token);
    if (!payload) return notFound();

    const evidence = await prisma.auditEvidence.findFirst({
      where: {
        id: payload.evidenceId,
        organizationId: payload.organizationId,
      },
    });
    if (!evidence) return notFound();
    if (evidence.expiresAt && evidence.expiresAt.getTime() < Date.now()) {
      return notFound();
    }

    const ua = request.headers.get("user-agent");
    const forwarded = request.headers.get("x-forwarded-for");
    const ip =
      forwarded?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;

    let sentAt: Date | null = null;
    if (payload.outboxId) {
      const outbox = await prisma.emailOutbox.findFirst({
        where: {
          id: payload.outboxId,
          organizationId: payload.organizationId,
        },
        select: { sentAt: true },
      });
      sentAt = outbox?.sentAt ?? null;
    }

    const bot = classifyEmailTraffic({ userAgent: ua, ip, sentAt });
    // Human-only interest signal — scanners never count as preview views
    if (!bot.isBot) {
      await prisma.emailEvent
        .create({
          data: {
            organizationId: payload.organizationId,
            type: EmailEventType.CLICKED,
            metadata: {
              source: "pow_preview",
              pitchId: payload.pitchId,
              evidenceId: payload.evidenceId,
              outboxId: payload.outboxId ?? null,
              category: bot.category,
            },
          },
        })
        .catch(() => undefined);
    }

    const abs = resolveEvidencePath(
      payload.organizationId,
      evidence.relativePath
    );
    const buf = await readFile(abs);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": evidence.contentType || "image/png",
        "Content-Length": String(buf.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}
