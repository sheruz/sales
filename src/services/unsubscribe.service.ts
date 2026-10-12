import { createHmac, timingSafeEqual } from "crypto";
import prisma from "@/lib/db/prisma";
import { SuppressionReason } from "@prisma/client";
import { env } from "@/lib/config/env";
import { emailSafetyService } from "@/services/email-safety.service";
import { sequenceEnrollmentService } from "@/services/sequence-enrollment.service";

function secret(): string {
  return env.JWT_SECRET || env.ENCRYPTION_KEY || "unsubscribe-dev-secret";
}

export function createUnsubscribeToken(input: {
  organizationId: string;
  email: string;
}): string {
  const payload = Buffer.from(
    JSON.stringify({
      o: input.organizationId,
      e: input.email.toLowerCase().trim(),
      t: Date.now(),
    })
  ).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyUnsubscribeToken(
  token: string
): { organizationId: string; email: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!json.o || !json.e) return null;
    return { organizationId: String(json.o), email: String(json.e) };
  } catch {
    return null;
  }
}

export function unsubscribeUrl(organizationId: string, email: string): string {
  const token = createUnsubscribeToken({ organizationId, email });
  const base = env.APP_URL.replace(/\/$/, "");
  return `${base}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export class UnsubscribeService {
  async applyToken(token: string) {
    const parsed = verifyUnsubscribeToken(token);
    if (!parsed) return { ok: false as const, error: "Invalid or expired link" };

    await emailSafetyService.suppress({
      organizationId: parsed.organizationId,
      email: parsed.email,
      reason: SuppressionReason.UNSUBSCRIBE,
      source: "one_click_unsubscribe",
    });

    // Stop open enrollments for this contact email
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId: parsed.organizationId,
        normalizedEmail: parsed.email.toLowerCase(),
      },
      select: { id: true },
    });
    for (const c of contacts) {
      await sequenceEnrollmentService.stopForContactUnsubscribe(
        parsed.organizationId,
        c.id
      );
    }

    return { ok: true as const, email: parsed.email };
  }
}

export const unsubscribeService = new UnsubscribeService();
