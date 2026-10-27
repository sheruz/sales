import { randomUUID } from "crypto";
import {
  OutreachSequenceStatus,
  PitchStatus,
  WebsiteAuditStatus,
  type Prisma,
} from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { ValidationError } from "@/lib/api/response";
import { CREDIT_ACTIONS } from "@/lib/billing/credit-actions";
import { withCreditReservation } from "@/lib/billing/with-credits";
import {
  POW_OUTREACH_STEPS,
  POW_SEQUENCE_NAME,
} from "@/lib/outbound/pow-sequence";
import { findingIdToType } from "@/lib/pow/constants";
import { recheckSeverityAFinding } from "@/lib/pow/recheck-severity-a";
import {
  extractFindingsFromAuditJson,
  pickUsableFindings,
  type UsableFinding,
} from "@/lib/pow/usable-findings";
import { generatePowEmails } from "@/lib/pow/writer";
import { caseStudyService } from "@/services/case-study.service";
import { starterOfferService } from "@/services/starter-offer.service";
import { outboundConfigService } from "@/services/outbound-config.service";

export type PowDraftPayload = {
  status: "ready" | "flagged" | "rejected" | "no_usable_finding";
  finding: UsableFinding | null;
  secondFinding: UsableFinding | null;
  steps: Array<{ day: 0 | 3 | 7 | 14; subject: string; body: string }>;
  validation: unknown;
  regenerated: boolean;
  modelUsed: string | null;
  starterOfferId: string | null;
  caseStudyId: string | null;
  evidenceIds: string[];
};

function hostFromUrl(url: string | null | undefined, fallback: string): string {
  if (!url) return fallback;
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname;
  } catch {
    return fallback;
  }
}

export class PowPitchService {
  async ensureProofOfWorkSequence(organizationId: string) {
    const existing = await prisma.outreachSequence.findFirst({
      where: { organizationId, isProofOfWork: true },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    if (existing) {
      if (existing.steps.length < 4) {
        await prisma.outreachSequenceStep.deleteMany({
          where: { sequenceId: existing.id },
        });
        await prisma.outreachSequenceStep.createMany({
          data: POW_OUTREACH_STEPS.map((s) => ({
            sequenceId: existing.id,
            stepOrder: s.stepOrder,
            delayMinutes: s.delayMinutes,
            subjectTemplate: s.subjectTemplate,
            bodyTemplate: s.bodyTemplate,
            emailStyle: s.emailStyle,
          })),
        });
      }
      return prisma.outreachSequence.findFirstOrThrow({
        where: { id: existing.id },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      });
    }

    const byName = await prisma.outreachSequence.findFirst({
      where: { organizationId, name: POW_SEQUENCE_NAME },
      include: { steps: true },
    });
    if (byName) {
      return prisma.outreachSequence.update({
        where: { id: byName.id },
        data: { isProofOfWork: true },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      });
    }

    return prisma.outreachSequence.create({
      data: {
        organizationId,
        name: POW_SEQUENCE_NAME,
        description:
          "Proof-of-work plain-text sequence (Day 0/3/7/14). Sending blocked until PoW3.",
        status: OutreachSequenceStatus.ACTIVE,
        stopOnReply: true,
        stopOnMeeting: true,
        stopOnUnsubscribe: true,
        isAutopilotDefault: false,
        isProofOfWork: true,
        steps: {
          create: POW_OUTREACH_STEPS.map((s) => ({
            stepOrder: s.stepOrder,
            delayMinutes: s.delayMinutes,
            subjectTemplate: s.subjectTemplate,
            bodyTemplate: s.bodyTemplate,
            emailStyle: s.emailStyle,
          })),
        },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
  }

  async getLatestDeepAudit(organizationId: string, companyId: string) {
    return prisma.websiteAudit.findFirst({
      where: {
        organizationId,
        companyId,
        mode: "deep",
        status: WebsiteAuditStatus.DONE,
      },
      orderBy: { createdAt: "desc" },
      include: {
        evidence: { orderBy: { createdAt: "asc" } },
      },
    });
  }

  async getStatus(organizationId: string, companyId: string) {
    const audit = await this.getLatestDeepAudit(organizationId, companyId);
    const findings = audit
      ? pickUsableFindings(extractFindingsFromAuditJson(audit.findings))
      : [];
    const pitch = await prisma.pitch.findFirst({
      where: {
        organizationId,
        companyId,
        kind: "pow",
        status: { in: [PitchStatus.DRAFT, PitchStatus.APPROVED] },
      },
      orderBy: { updatedAt: "desc" },
    });
    return {
      audit: audit
        ? {
            id: audit.id,
            status: audit.status,
            createdAt: audit.createdAt.toISOString(),
            evidence: audit.evidence.map((e) => ({
              id: e.id,
              kind: e.kind,
            })),
          }
        : null,
      usableFindings: findings,
      noUsableFinding: findings.length === 0,
      pitch,
      sequence: await this.ensureProofOfWorkSequence(organizationId),
    };
  }

  /**
   * Generate (or regenerate) PoW draft from latest DONE deep audit.
   * Charges audit_pitch once per generation.
   */
  async generate(
    organizationId: string,
    companyId: string,
    userId: string,
    opts?: { contactId?: string; regenerateFromPitchId?: string }
  ) {
    const company = await prisma.company.findFirst({
      where: { id: companyId, organizationId, deletedAt: null },
    });
    if (!company) throw new ValidationError("Company not found");

    const audit = await this.getLatestDeepAudit(organizationId, companyId);
    if (!audit) {
      throw new ValidationError("No DONE deep audit — run Deep audit first");
    }

    const usable = pickUsableFindings(
      extractFindingsFromAuditJson(audit.findings)
    );
    if (usable.length === 0) {
      const empty: PowDraftPayload = {
        status: "no_usable_finding",
        finding: null,
        secondFinding: null,
        steps: [],
        validation: { ok: false, errors: ["No usable finding"] },
        regenerated: false,
        modelUsed: null,
        starterOfferId: null,
        caseStudyId: null,
        evidenceIds: audit.evidence.map((e) => e.id),
      };
      return {
        status: "no_usable_finding" as const,
        draft: empty,
        pitch: null,
      };
    }

    const contact =
      (opts?.contactId
        ? await prisma.contact.findFirst({
            where: { id: opts.contactId, organizationId, companyId },
          })
        : null) ||
      (await prisma.contact.findFirst({
        where: { organizationId, companyId, status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
      }));
    if (!contact) throw new ValidationError("No contact on company");

    const finding = usable[0]!;
    const secondFinding = usable[1] ?? null;
    const findingType = findingIdToType(finding.id);
    const offer = await starterOfferService.matchForFindingType(
      organizationId,
      findingType
    );
    const caseStudy = await caseStudyService.firstActive(organizationId);

    const outbound = await outboundConfigService.getConfig(organizationId);
    const senderName =
      outbound.businessName.trim() ||
      (
        await prisma.organization.findFirst({
          where: { id: organizationId },
          select: { name: true, legalName: true },
        })
      )?.legalName ||
      "Our team";
    const address = outbound.physicalAddress.trim();
    const findingsRaw =
      audit.findings && typeof audit.findings === "object"
        ? (audit.findings as Record<string, unknown>)
        : null;
    const host = hostFromUrl(
      (typeof findingsRaw?.finalUrl === "string"
        ? findingsRaw.finalUrl
        : null) || company.website,
      company.domain || company.name
    );

    const credit = await withCreditReservation({
      organizationId,
      actionType: CREDIT_ACTIONS.AUDIT_PITCH,
      actorUserId: userId,
      referenceType: "pow_pitch",
      referenceId: opts?.regenerateFromPitchId || randomUUID(),
      purpose: "audit_pitch",
      fn: async () => {
        const written = await generatePowEmails({
          organizationId,
          userId,
          companyName: company.name,
          domainOrHost: host,
          firstName: contact.firstName,
          finding,
          secondFinding,
          starterOffer: offer
            ? {
                name: offer.name,
                price: Number(offer.price),
                currency: offer.currency,
                deliveryDays: offer.deliveryDays,
                includes: offer.includes,
              }
            : null,
          caseStudy: caseStudy
            ? {
                clientType: caseStudy.clientType,
                problem: caseStudy.problem,
                whatBuilt: caseStudy.whatBuilt,
                result: caseStudy.result,
              }
            : null,
          senderName,
          businessAddress: address,
          billingAuthorized: true,
        });

        const footerLines = [
          senderName,
          address || null,
          "Reply stop to unsubscribe.",
        ]
          .filter(Boolean)
          .join("\n");

        const steps = written.steps.map((s) => ({
          ...s,
          body: /unsubscribe|reply stop/i.test(s.body)
            ? s.body
            : `${s.body.trimEnd()}\n\n${footerLines}`,
        }));

        const draft: PowDraftPayload = {
          status:
            written.status === "ready"
              ? "ready"
              : written.status === "flagged"
                ? "flagged"
                : "rejected",
          finding,
          secondFinding,
          steps,
          validation: written.validation,
          regenerated: written.regenerated,
          modelUsed: written.modelUsed,
          starterOfferId: offer?.id ?? null,
          caseStudyId: caseStudy?.id ?? null,
          evidenceIds: audit.evidence.map((e) => e.id),
        };

        // Supersede prior pow drafts for this contact
        await prisma.pitch.updateMany({
          where: {
            organizationId,
            companyId,
            contactId: contact.id,
            kind: "pow",
            status: PitchStatus.DRAFT,
          },
          data: { status: PitchStatus.SUPERSEDED },
        });

        const firstLine = steps[0]?.body.split("\n")[0] ?? "";
        const pitch = await prisma.pitch.create({
          data: {
            organizationId,
            companyId,
            contactId: contact.id,
            websiteAuditId: audit.id,
            status: PitchStatus.DRAFT,
            kind: "pow",
            personalizedFirstLine: firstLine,
            shortPitch: steps[0]?.body ?? "",
            topIssue: finding.title,
            recommendedService: offer?.name ?? null,
            confidence: written.status === "ready" ? 80 : 40,
            greeting: firstLine,
            findingTitle: finding.title,
            findingText: finding.evidence,
            bodyHtml: null,
            preheader: steps[0]?.subject ?? null,
            powDraft: draft as unknown as Prisma.InputJsonValue,
            powStarterOfferId: offer?.id ?? null,
            powStaleAt: null,
            missingVars: steps[0]?.body.includes("{{preview_url}}")
              ? []
              : ["preview_url"],
          },
        });

        await this.ensureProofOfWorkSequence(organizationId);
        return { pitch, draft };
      },
    });

    if (!credit.ok) {
      throw new ValidationError(credit.message || "Out of credits");
    }

    return {
      status: credit.result.draft.status,
      draft: credit.result.draft,
      pitch: credit.result.pitch,
    };
  }

  async regenerate(organizationId: string, pitchId: string, userId: string) {
    const pitch = await prisma.pitch.findFirst({
      where: { id: pitchId, organizationId, kind: "pow" },
    });
    if (!pitch) throw new ValidationError("PoW pitch not found");
    return this.generate(organizationId, pitch.companyId, userId, {
      contactId: pitch.contactId,
      regenerateFromPitchId: pitchId,
    });
  }

  async edit(
    organizationId: string,
    pitchId: string,
    userId: string,
    steps: Array<{ day: 0 | 3 | 7 | 14; subject: string; body: string }>
  ) {
    const pitch = await prisma.pitch.findFirst({
      where: { id: pitchId, organizationId, kind: "pow" },
    });
    if (!pitch) throw new ValidationError("PoW pitch not found");
    const prev = (pitch.powDraft || {}) as PowDraftPayload;
    const draft: PowDraftPayload = {
      ...prev,
      steps,
      status: prev.status === "no_usable_finding" ? prev.status : "ready",
    };
    return prisma.pitch.update({
      where: { id: pitchId },
      data: {
        powDraft: draft as unknown as Prisma.InputJsonValue,
        shortPitch: steps[0]?.body ?? pitch.shortPitch,
        personalizedFirstLine:
          steps[0]?.body.split("\n")[0] ?? pitch.personalizedFirstLine,
        preheader: steps[0]?.subject ?? pitch.preheader,
        editedByUser: true,
        approvedBy: userId,
      },
    });
  }

  async approve(organizationId: string, pitchId: string, userId: string) {
    const pitch = await prisma.pitch.findFirst({
      where: { id: pitchId, organizationId, kind: "pow" },
    });
    if (!pitch) throw new ValidationError("PoW pitch not found");
    const draft = pitch.powDraft as PowDraftPayload | null;
    if (!draft || draft.status === "no_usable_finding") {
      throw new ValidationError("No usable finding");
    }
    if (draft.status === "rejected") {
      throw new ValidationError("Draft failed validation — regenerate");
    }
    return prisma.pitch.update({
      where: { id: pitchId },
      data: {
        status: PitchStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy: userId,
      },
    });
  }

  /** PoW3 hook: re-check Severity A before first send; mark stale if fixed */
  async recheckBeforeSend(organizationId: string, pitchId: string) {
    const pitch = await prisma.pitch.findFirst({
      where: { id: pitchId, organizationId, kind: "pow" },
      include: {
        websiteAudit: true,
        company: true,
      },
    });
    if (!pitch) throw new ValidationError("PoW pitch not found");
    const draft = pitch.powDraft as PowDraftPayload | null;
    const finding = draft?.finding;
    if (!finding || finding.severity !== "A") {
      return { stale: false, recheck: null };
    }
    const url =
      companyWebsite(pitch.company.website) ||
      (pitch.websiteAudit.findings as { finalUrl?: string } | null)?.finalUrl;
    if (!url) {
      return { stale: false, recheck: null };
    }
    const recheck = await recheckSeverityAFinding({
      findingId: finding.id,
      url,
      evidence: finding.evidence,
    });
    if (!recheck.stillBroken) {
      await prisma.pitch.update({
        where: { id: pitchId },
        data: { powStaleAt: new Date() },
      });
      return { stale: true, recheck };
    }
    return { stale: false, recheck };
  }
}

function companyWebsite(website: string | null | undefined): string | null {
  if (!website) return null;
  return website.includes("://") ? website : `https://${website}`;
}

export const powPitchService = new PowPitchService();
