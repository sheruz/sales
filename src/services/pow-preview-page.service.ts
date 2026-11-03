/**
 * PoW personal preview page — /for/{publicSlug}
 * Findings + screenshots + offer + case study + CTA; visit tracking; hot-lead alert.
 */
import { randomBytes, randomUUID } from "crypto";
import { NotificationType, SuppressionReason } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { BILLING_ACTIONS } from "@/lib/billing/actions";
import { withCreditReservation } from "@/lib/billing/with-credits";
import {
  mintPowEvidenceUrl,
  powPreviewPageUrl,
  previewTtlMsFromEnv,
} from "@/lib/pow/preview-token";
import { emailSafetyService } from "@/services/email-safety.service";
import { emailBrandingService } from "@/services/email-branding.service";
import { notificationService } from "@/services/notification.service";
import { classifyEmailTraffic } from "@/lib/security/email-bot-filter";
import { ValidationError } from "@/lib/api/response";
import { appHome } from "@/lib/app-paths";

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "preview"
  );
}

export class PowPreviewPageService {
  /**
   * Ensure a personal preview page exists for a PoW pitch.
   * Charges preview_page (3) once. Returns public URL for {{preview_url}}.
   */
  async ensureForPitch(input: {
    organizationId: string;
    pitchId: string;
    actorUserId?: string | null;
    outboxId?: string;
  }): Promise<{ publicSlug: string; url: string; pageId: string }> {
    const existing = await prisma.powPreviewPage.findUnique({
      where: { pitchId: input.pitchId },
    });
    if (existing && !existing.removedAt) {
      return {
        publicSlug: existing.publicSlug,
        url: powPreviewPageUrl(existing.publicSlug),
        pageId: existing.id,
      };
    }

    const pitch = await prisma.pitch.findFirst({
      where: {
        id: input.pitchId,
        organizationId: input.organizationId,
        kind: "pow",
      },
      include: {
        company: { select: { id: true, name: true, domain: true } },
        contact: { select: { id: true } },
      },
    });
    if (!pitch) throw new ValidationError("PoW pitch not found");

    const pageId = existing?.id ?? randomUUID();
    const publicSlug =
      existing?.publicSlug ??
      `${slugify(pitch.company.domain || pitch.company.name)}-${randomBytes(4).toString("hex")}`;
    const expiresAt = new Date(Date.now() + previewTtlMsFromEnv());

    if (existing?.removedAt) {
      await prisma.powPreviewPage.update({
        where: { id: existing.id },
        data: {
          removedAt: null,
          expiresAt,
          visitCount: 0,
          firstHumanVisitAt: null,
          lastHumanVisitAt: null,
          totalDwellMs: 0,
          hotAlertedAt: null,
        },
      });
      return {
        publicSlug: existing.publicSlug,
        url: powPreviewPageUrl(existing.publicSlug),
        pageId: existing.id,
      };
    }

    const charged = await withCreditReservation({
      organizationId: input.organizationId,
      actionType: BILLING_ACTIONS.PREVIEW_PAGE,
      actorUserId: input.actorUserId ?? undefined,
      referenceType: "pow_preview_page",
      referenceId: pageId,
      purpose: "preview_page",
      fn: async () => {
        await prisma.powPreviewPage.create({
          data: {
            id: pageId,
            organizationId: input.organizationId,
            companyId: pitch.companyId,
            contactId: pitch.contactId,
            pitchId: pitch.id,
            publicSlug,
            expiresAt,
            creditChargedAt: new Date(),
          },
        });
      },
    });

    if (!charged.ok) {
      throw new ValidationError(
        charged.reason === "out_of_credits"
          ? "Out of credits — cannot create Proof of Work preview page"
          : charged.message || "Cannot create Proof of Work preview page"
      );
    }

    return {
      publicSlug,
      url: powPreviewPageUrl(publicSlug),
      pageId,
    };
  }

  async getPublicView(publicSlug: string) {
    const page = await prisma.powPreviewPage.findUnique({
      where: { publicSlug },
      include: {
        pitch: true,
        company: {
          select: {
            id: true,
            name: true,
            website: true,
            domain: true,
            industry: true,
          },
        },
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        organization: {
          select: { id: true, name: true, legalName: true },
        },
      },
    });
    if (!page || page.removedAt) return null;
    if (page.expiresAt.getTime() < Date.now()) return null;

    const draft =
      page.pitch.powDraft &&
      typeof page.pitch.powDraft === "object" &&
      !Array.isArray(page.pitch.powDraft)
        ? (page.pitch.powDraft as Record<string, unknown>)
        : null;

    const finding =
      draft?.finding && typeof draft.finding === "object"
        ? (draft.finding as Record<string, unknown>)
        : null;
    const secondFinding =
      draft?.secondFinding && typeof draft.secondFinding === "object"
        ? (draft.secondFinding as Record<string, unknown>)
        : null;

    const evidenceIds = Array.isArray(draft?.evidenceIds)
      ? (draft!.evidenceIds as string[]).filter((x) => typeof x === "string")
      : [];

    const evidenceRows =
      evidenceIds.length > 0
        ? await prisma.auditEvidence.findMany({
            where: {
              organizationId: page.organizationId,
              id: { in: evidenceIds },
            },
            select: {
              id: true,
              kind: true,
              expiresAt: true,
              contentType: true,
            },
            orderBy: { createdAt: "asc" },
          })
        : [];

    const screenshots = evidenceRows.map((e) => {
      const minted = mintPowEvidenceUrl({
        organizationId: page.organizationId,
        evidenceId: e.id,
        pitchId: page.pitchId,
        expiresAt: e.expiresAt ?? page.expiresAt,
      });
      return {
        id: e.id,
        kind: e.kind,
        url: minted.url,
      };
    });

    let offer: {
      name: string;
      price: number;
      currency: string;
      deliveryDays: number;
      includes: string;
    } | null = null;
    if (page.pitch.powStarterOfferId) {
      const row = await prisma.starterOffer.findFirst({
        where: {
          id: page.pitch.powStarterOfferId,
          organizationId: page.organizationId,
        },
      });
      if (row) {
        offer = {
          name: row.name,
          price: Number(row.price),
          currency: row.currency,
          deliveryDays: row.deliveryDays,
          includes: row.includes,
        };
      }
    }

    let caseStudy: {
      clientType: string;
      problem: string;
      whatBuilt: string;
      result: string;
    } | null = null;
    const caseStudyId =
      typeof draft?.caseStudyId === "string" ? draft.caseStudyId : null;
    if (caseStudyId) {
      const row = await prisma.caseStudy.findFirst({
        where: { id: caseStudyId, organizationId: page.organizationId },
      });
      if (row) {
        caseStudy = {
          clientType: row.clientType,
          problem: row.problem,
          whatBuilt: row.whatBuilt,
          result: row.result,
        };
      }
    }

    const branding = await emailBrandingService.resolveForSend(
      page.organizationId
    );
    const tenantName =
      branding.companyLegalName ||
      page.organization.legalName ||
      page.organization.name;

    const orgRow = await prisma.organization.findFirst({
      where: { id: page.organizationId },
      select: { billingEmail: true },
    });
    const replyEmail = orgRow?.billingEmail?.trim() || null;

    return {
      pageId: page.id,
      publicSlug: page.publicSlug,
      expiresAt: page.expiresAt.toISOString(),
      companyName: page.company.name,
      contactFirstName: page.contact.firstName,
      tenant: {
        name: tenantName,
        logoPath: branding.logoUrl,
        websiteUrl: branding.websiteUrl,
        ctaLabel: branding.ctaLabel || "Book a call",
        bookingUrl: branding.ctaUrl || "",
      },
      findings: [finding, secondFinding].filter(Boolean),
      screenshots,
      offer,
      caseStudy,
      replyMailto: replyEmail
        ? `mailto:${replyEmail}?subject=${encodeURIComponent(
            `Re: website notes for ${page.company.name}`
          )}`
        : branding.ctaUrl || null,
    };
  }

  async recordVisit(input: {
    publicSlug: string;
    userAgent: string | null;
    ip: string | null;
    dwellMs?: number;
  }): Promise<{ ok: boolean; firstHuman?: boolean }> {
    const page = await prisma.powPreviewPage.findUnique({
      where: { publicSlug: input.publicSlug },
      include: {
        contact: { select: { id: true, email: true, fullName: true } },
        company: { select: { id: true, name: true } },
      },
    });
    if (!page || page.removedAt) return { ok: false };
    if (page.expiresAt.getTime() < Date.now()) return { ok: false };

    const bot = classifyEmailTraffic({
      userAgent: input.userAgent,
      ip: input.ip,
      sentAt: null,
    });
    if (bot.isBot) return { ok: true, firstHuman: false };

    const isFirst = !page.firstHumanVisitAt;
    const dwell = Math.max(
      0,
      Math.min(Number(input.dwellMs) || 0, 30 * 60 * 1000)
    );

    await prisma.powPreviewPage.update({
      where: { id: page.id },
      data: {
        visitCount: { increment: 1 },
        firstHumanVisitAt: page.firstHumanVisitAt ?? new Date(),
        lastHumanVisitAt: new Date(),
        totalDwellMs: { increment: dwell },
      },
    });

    if (isFirst && !page.hotAlertedAt) {
      await this.fireHotLeadAlert(page);
    }

    return { ok: true, firstHuman: isFirst };
  }

  private async fireHotLeadAlert(page: {
    id: string;
    organizationId: string;
    companyId: string;
    contactId: string;
    publicSlug: string;
    contact: { fullName: string; email: string | null };
    company: { name: string };
  }) {
    const owners = await prisma.organizationUser.findMany({
      where: {
        organizationId: page.organizationId,
        status: "ACTIVE",
        OR: [{ isPrimaryAdmin: true }, { role: { key: "company_admin" } }],
      },
      select: { userId: true, user: { select: { email: true } } },
      take: 5,
    });

    const title = `Hot lead: ${page.company.name}`;
    const body = `${page.contact.fullName || "Contact"} opened your Proof of Work preview${
      page.contact.email ? ` (${page.contact.email})` : ""
    }.`;
    const href = appHome(`/companies/${page.companyId}`);

    for (const m of owners) {
      await notificationService.notify({
        organizationId: page.organizationId,
        userId: m.userId,
        toEmail: m.user.email,
        type: NotificationType.POW_HOT_LEAD,
        title,
        body,
        href,
        metadata: {
          source: "pow_preview",
          pageId: page.id,
          publicSlug: page.publicSlug,
          contactId: page.contactId,
          companyId: page.companyId,
        },
        sendEmail: true,
      });
    }

    await prisma.powPreviewPage.update({
      where: { id: page.id },
      data: { hotAlertedAt: new Date() },
    });
  }

  async removeBySlug(publicSlug: string): Promise<{ ok: boolean }> {
    const page = await prisma.powPreviewPage.findUnique({
      where: { publicSlug },
      include: { contact: { select: { email: true } } },
    });
    if (!page || page.removedAt) return { ok: true };

    await prisma.powPreviewPage.update({
      where: { id: page.id },
      data: { removedAt: new Date() },
    });

    if (page.contact.email) {
      const already = await emailSafetyService.isSuppressed(
        page.organizationId,
        page.contact.email
      );
      if (!already) {
        await emailSafetyService.suppress({
          organizationId: page.organizationId,
          email: page.contact.email,
          reason: SuppressionReason.UNSUBSCRIBE,
          source: "pow_preview_not_relevant",
        });
      }
    }
    return { ok: true };
  }

  async listHotLeads(organizationId: string, take = 50) {
    return prisma.powPreviewPage.findMany({
      where: {
        organizationId,
        firstHumanVisitAt: { not: null },
        removedAt: null,
      },
      orderBy: { firstHumanVisitAt: "desc" },
      take,
      include: {
        company: { select: { id: true, name: true, website: true } },
        contact: {
          select: {
            id: true,
            fullName: true,
            email: true,
            title: true,
          },
        },
        pitch: { select: { id: true, topIssue: true, status: true } },
      },
    });
  }
}

export const powPreviewPageService = new PowPreviewPageService();
