import { createHmac, timingSafeEqual } from "crypto";
import {
  OpportunityStage,
  OpportunityStatus,
  TaskPriority,
  TaskStatus,
  TaskType,
  TimelineActor,
  CompanyTimelineEventType,
} from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { ValidationError } from "@/lib/api/response";
import {
  INBOUND_SOURCE_LABELS,
  isInboundSourceKey,
  type InboundSourceKey,
} from "@/lib/inbound/constants";
import { opportunityService } from "@/services/opportunity.service";
import { timelineService } from "@/services/timeline.service";
import { companyService, extractDomain } from "@/services/company.service";
import { sendEmailWithConfig } from "@/lib/email/send-mail";

export type WebsiteInboundPayload = {
  source: InboundSourceKey;
  name: string;
  email: string;
  company?: string;
  website?: string;
  needs?: string[];
  budget?: string;
  startTiming?: string;
  message?: string;
  /** Full brief / waitlist note for timeline */
  brief: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Website", lastName: "Lead" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function domainFromPayload(payload: WebsiteInboundPayload): string | null {
  const fromWebsite = extractDomain(payload.website);
  if (fromWebsite) return fromWebsite;
  const companyHint = payload.company?.trim() || "";
  const maybeDomain = extractDomain(
    companyHint.includes(".") && !companyHint.includes(" ")
      ? companyHint
      : undefined
  );
  if (maybeDomain) return maybeDomain;
  const emailDomain = payload.email.split("@")[1]?.toLowerCase();
  if (
    emailDomain &&
    !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"].includes(
      emailDomain
    )
  ) {
    return emailDomain;
  }
  return null;
}

export function verifyInboundAuth(
  request: Request,
  rawBody: string
): { ok: true } | { ok: false; reason: string } {
  const secret = env.REVENUE_OS_SECRET?.trim();
  if (!secret) {
    return { ok: false, reason: "REVENUE_OS_SECRET not configured" };
  }

  const auth = request.headers.get("authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) {
    const a = Buffer.from(bearer);
    const b = Buffer.from(secret);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return { ok: true };
    }
  }

  const sigHeader =
    request.headers.get("x-delvix-signature") ||
    request.headers.get("x-revenue-os-signature") ||
    "";
  const provided = sigHeader.replace(/^sha256=/i, "").trim();
  if (provided) {
    const expected = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    try {
      const a = Buffer.from(provided, "hex");
      const b = Buffer.from(expected, "hex");
      if (a.length === b.length && timingSafeEqual(a, b)) {
        return { ok: true };
      }
    } catch {
      /* invalid hex */
    }
  }

  return { ok: false, reason: "invalid_signature" };
}

async function notifyEmail(subject: string, text: string) {
  const to = env.NOTIFY_EMAIL;
  if (
    !to ||
    !env.SMTP_HOST ||
    !env.SMTP_USER ||
    !env.SMTP_PASSWORD ||
    !env.SMTP_FROM_EMAIL
  ) {
    console.warn(
      "[website-inbound] Email notify skipped (NOTIFY_EMAIL / SMTP not fully configured)"
    );
    return;
  }
  await sendEmailWithConfig(
    {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      fromName: env.SMTP_FROM_NAME,
      fromEmail: env.SMTP_FROM_EMAIL,
    },
    { to, subject, text }
  );
}

export class WebsiteInboundService {
  async ingest(payload: WebsiteInboundPayload) {
    if (!isInboundSourceKey(payload.source)) {
      throw new ValidationError("Invalid inbound source");
    }
    const organizationId = env.WEBSITE_INBOUND_ORG_ID;
    if (!organizationId) {
      throw new ValidationError("WEBSITE_INBOUND_ORG_ID is not configured");
    }

    const org = await prisma.organization.findFirst({
      where: { id: organizationId },
      select: { id: true, name: true },
    });
    if (!org) throw new ValidationError("Inbound organization not found");

    const email = normalizeEmail(payload.email);
    const { firstName, lastName } = splitName(payload.name);
    const fullName = `${firstName} ${lastName}`.trim();
    const domain = domainFromPayload(payload);
    const companyName =
      payload.company?.trim() ||
      (domain ? domain.split(".")[0] : null) ||
      `${fullName} (website)`;

    const source = await opportunityService.ensureSource(
      organizationId,
      payload.source,
      INBOUND_SOURCE_LABELS[payload.source]
    );

    // Dedupe company by domain
    let company =
      domain != null
        ? await prisma.company.findFirst({
            where: {
              organizationId,
              deletedAt: null,
              OR: [{ domain }, { normalizedDomain: domain }],
            },
          })
        : null;

    if (!company) {
      company = await companyService.create(organizationId, {
        name: companyName,
        domain: domain ?? undefined,
        website: payload.website?.trim() || (domain ? `https://${domain}` : undefined),
        source: payload.source,
        metadata: { inbound: true, channel: "delvixstudio.com" },
      });
    } else {
      await prisma.company.update({
        where: { id: company.id },
        data: {
          source: company.source || payload.source,
          website:
            company.website ||
            payload.website?.trim() ||
            (domain ? `https://${domain}` : undefined),
        },
      });
    }

    // Dedupe contact by org-scoped normalized email
    let contact = await prisma.contact.findFirst({
      where: { organizationId, normalizedEmail: email },
    });
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          organizationId,
          companyId: company.id,
          firstName,
          lastName,
          fullName,
          email,
          normalizedEmail: email,
          source: payload.source,
          metadata: { inbound: true },
        },
      });
    } else if (contact.companyId !== company.id) {
      // Keep existing company association; still attach opportunity to resolved company
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: {
          firstName: contact.firstName || firstName,
          lastName: contact.lastName || lastName,
          fullName: contact.fullName || fullName,
        },
      });
    }

    const whyNow =
      payload.source === "autopilot_waitlist"
        ? "Requested Delvix Autopilot early access via delvixstudio.com"
        : "Submitted a project brief via delvixstudio.com";

    const opportunity = await prisma.opportunity.create({
      data: {
        organizationId,
        companyId: company.id,
        primaryContactId: contact.id,
        sourceId: source.id,
        status: OpportunityStatus.OPEN,
        stage: OpportunityStage.NEW,
        score: 70,
        confidence: 80,
        whyNow,
        likelyProblem:
          payload.message?.trim() ||
          payload.needs?.join(", ") ||
          "Inbound website lead",
        recommendedAction: "Reply within one business day",
        nextActionAt: new Date(),
      },
    });

    await timelineService.record({
      organizationId,
      companyId: company.id,
      contactId: contact.id,
      opportunityId: opportunity.id,
      type: CompanyTimelineEventType.INBOUND_FORM,
      title:
        payload.source === "autopilot_waitlist"
          ? "Inbound: Autopilot waitlist"
          : "Inbound: Website project brief",
      details: {
        source: payload.source,
        brief: payload.brief,
        needs: payload.needs ?? [],
        budget: payload.budget ?? null,
        startTiming: payload.startTiming ?? null,
        email,
        name: fullName,
      },
      actor: TimelineActor.SYSTEM,
      dedupeKey: `inbound:${payload.source}:${email}:${opportunity.id}`,
    });

    await prisma.opportunityEvent.create({
      data: {
        organizationId,
        opportunityId: opportunity.id,
        type: "CREATED",
        title: "Inbound form submitted",
        description: payload.brief.slice(0, 2000),
        metadata: { source: payload.source, inbound: true },
      },
    });

    // Dashboard notify: high-priority task for primary admin / owners
    const owners = await prisma.organizationUser.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        OR: [
          { isPrimaryAdmin: true },
          { role: { key: { in: ["OWNER", "ADMIN", "company_admin"] } } },
        ],
      },
      select: { userId: true },
      take: 5,
    });
    const assigneeId = owners[0]?.userId ?? null;
    await prisma.task.create({
      data: {
        organizationId,
        title:
          payload.source === "autopilot_waitlist"
            ? `Inbound waitlist: ${fullName}`
            : `Inbound brief: ${fullName}`,
        description: payload.brief.slice(0, 4000),
        type: TaskType.FOLLOW_UP,
        opportunityId: opportunity.id,
        companyId: company.id,
        contactId: contact.id,
        assignedToId: assigneeId,
        priority: TaskPriority.HIGH,
        status: TaskStatus.PENDING,
        dueDate: new Date(),
      },
    });

    const appUrl = env.APP_URL.replace(/\/$/, "");
    const subject = `[Delvix inbound] ${INBOUND_SOURCE_LABELS[payload.source]} — ${fullName}`;
    const text = [
      `New inbound lead from delvixstudio.com`,
      ``,
      `Source: ${payload.source}`,
      `Name: ${fullName}`,
      `Email: ${email}`,
      `Company: ${companyName}`,
      `Domain: ${domain || "—"}`,
      ``,
      `Opportunity: ${appUrl}/dashboard/opportunities/${opportunity.id}`,
      ``,
      `—— Brief ——`,
      payload.brief,
    ].join("\n");

    try {
      await notifyEmail(subject, text);
    } catch (err) {
      console.error(
        "[website-inbound] notify email failed",
        err instanceof Error ? err.message : err
      );
    }

    return {
      organizationId,
      companyId: company.id,
      contactId: contact.id,
      opportunityId: opportunity.id,
      source: payload.source,
    };
  }
}

export const websiteInboundService = new WebsiteInboundService();
