import { randomUUID } from "crypto";
import prisma from "@/lib/db/prisma";
import {
  CompanyAuditStatus,
  CompanyEnrichmentStatus,
  ConversationChannel,
  EmailEventType,
  EmailOutboxPurpose,
  EmailOutboxStatus,
  OpportunityStage,
  OutreachSequenceStatus,
  PitchStatus,
  SequenceEnrollmentSource,
  SequenceEnrollmentStatus,
  SequenceExecutionStatus,
  CompanyTimelineEventType,
  TimelineActor,
  type Prisma,
} from "@prisma/client";
import { ValidationError } from "@/lib/api/response";
import {
  outboundConfigService,
  type OutboundConfig,
} from "@/services/outbound-config.service";
import { mailboxPoolService } from "@/services/mailbox-pool.service";
import { sequenceEnrollmentService } from "@/services/sequence-enrollment.service";
import { emailSafetyService } from "@/services/email-safety.service";
import { inboxService } from "@/services/inbox.service";
import { timelineService } from "@/services/timeline.service";
import { isEnrollableVerification } from "@/lib/enrichment/verification";
import type { EmailVerificationStatus } from "@/lib/enrichment/types";
import { isCountryAllowed } from "@/lib/outbound/country-allowlist";
import { isInboundSourceKey } from "@/lib/inbound/constants";
import { buildListUnsubscribeHeaders } from "@/lib/outbound/compliance";
import {
  COLD_OUTREACH_NAME,
  COLD_OUTREACH_STEPS,
  INBOUND_OUTREACH_NAME,
  INBOUND_OUTREACH_STEPS,
} from "@/lib/outbound/cold-sequence";
import {
  nextSendWindowUtc,
  resolveOutboundTimezone,
} from "@/lib/outbound/timezone";
import {
  buildSequenceTemplateVars,
  enrollmentStepIdempotencyKey,
  renderSequenceTemplateDetailed,
  REQUIRED_PITCH_VARS,
} from "@/lib/sequences/runtime";
import { unsubscribeUrl } from "@/services/unsubscribe.service";
import { resolveEnrollmentSteps } from "@/services/sequence-enrollment.service";
import { renderOutboundEmail } from "@/lib/email/render-outbound";
import { emailBrandingService } from "@/services/email-branding.service";
import { assertOutboundFromAllowed } from "@/lib/email/free-mail";
import { EmailStyle } from "@prisma/client";

function startOfUtcDay() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export class OutboundJobService {
  async getConfig(organizationId: string) {
    return outboundConfigService.getConfig(organizationId);
  }

  async setConfig(organizationId: string, patch: Partial<OutboundConfig>) {
    return outboundConfigService.setConfig(organizationId, patch);
  }

  /** Ensure Cold outreach default sequence exists (ACTIVE, 3 steps). */
  async ensureColdOutreachSequence(organizationId: string) {
    const existing = await prisma.outreachSequence.findFirst({
      where: { organizationId, isAutopilotDefault: true },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    if (existing) {
      if (existing.status !== OutreachSequenceStatus.ACTIVE) {
        await prisma.outreachSequence.update({
          where: { id: existing.id },
          data: { status: OutreachSequenceStatus.ACTIVE },
        });
      }
      // Sync cold step styles — always BRANDED (no plain-text sends)
      for (const s of existing.steps) {
        if (s.emailStyle !== EmailStyle.BRANDED) {
          await prisma.outreachSequenceStep.update({
            where: { id: s.id },
            data: { emailStyle: EmailStyle.BRANDED },
          });
        }
      }
      return prisma.outreachSequence.findFirstOrThrow({
        where: { id: existing.id },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      });
    }

    const byName = await prisma.outreachSequence.findFirst({
      where: { organizationId, name: COLD_OUTREACH_NAME },
      include: { steps: true },
    });
    if (byName) {
      for (const s of byName.steps) {
        if (s.emailStyle !== EmailStyle.BRANDED) {
          await prisma.outreachSequenceStep.update({
            where: { id: s.id },
            data: { emailStyle: EmailStyle.BRANDED },
          });
        }
      }
      return prisma.outreachSequence.update({
        where: { id: byName.id },
        data: {
          isAutopilotDefault: true,
          status: OutreachSequenceStatus.ACTIVE,
        },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      });
    }

    return prisma.outreachSequence.create({
      data: {
        organizationId,
        name: COLD_OUTREACH_NAME,
        description:
          "Autopilot cold outreach (day 0 / 3 / 7). Editable — uses approved pitch variables.",
        status: OutreachSequenceStatus.ACTIVE,
        isAutopilotDefault: true,
        stopOnReply: true,
        stopOnMeeting: true,
        stopOnUnsubscribe: true,
        steps: {
          create: COLD_OUTREACH_STEPS.map((s) => ({
            id: randomUUID(),
            stepOrder: s.stepOrder,
            delayMinutes: s.delayMinutes,
            channel: ConversationChannel.EMAIL,
            subjectTemplate: s.subjectTemplate,
            bodyTemplate: s.bodyTemplate,
            emailStyle: EmailStyle.BRANDED,
            isActive: true,
          })),
        },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
  }

  /** Inbound / Meta — BRANDED single-step (or multi) sequence. */
  async ensureInboundOutreachSequence(organizationId: string) {
    const existing = await prisma.outreachSequence.findFirst({
      where: { organizationId, name: INBOUND_OUTREACH_NAME },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    if (existing) {
      if (existing.status !== OutreachSequenceStatus.ACTIVE) {
        await prisma.outreachSequence.update({
          where: { id: existing.id },
          data: { status: OutreachSequenceStatus.ACTIVE },
        });
      }
      return prisma.outreachSequence.findFirstOrThrow({
        where: { id: existing.id },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      });
    }
    return prisma.outreachSequence.create({
      data: {
        organizationId,
        name: INBOUND_OUTREACH_NAME,
        description:
          "Inbound / Meta leads — branded HTML email using approved pitch.",
        status: OutreachSequenceStatus.ACTIVE,
        isAutopilotDefault: false,
        stopOnReply: true,
        stopOnMeeting: true,
        stopOnUnsubscribe: true,
        steps: {
          create: INBOUND_OUTREACH_STEPS.map((s) => ({
            id: randomUUID(),
            stepOrder: s.stepOrder,
            delayMinutes: s.delayMinutes,
            channel: ConversationChannel.EMAIL,
            subjectTemplate: s.subjectTemplate,
            bodyTemplate: s.bodyTemplate,
            emailStyle: EmailStyle.BRANDED,
            isActive: true,
          })),
        },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
  }

  async dashboard(organizationId: string) {
    const day = startOfUtcDay();
    const config = await this.getConfig(organizationId);
    const now = new Date();
    const [
      queued,
      held,
      sentToday,
      failed,
      enrolledToday,
      mailboxes,
      suppressCount,
      dueNow,
      waitingForWindow,
      openedToday,
      clickedToday,
    ] = await Promise.all([
      prisma.emailOutbox.count({
        where: { organizationId, status: EmailOutboxStatus.QUEUED },
      }),
      prisma.emailOutbox.count({
        where: { organizationId, status: EmailOutboxStatus.HELD },
      }),
      prisma.emailOutbox.count({
        where: {
          organizationId,
          status: EmailOutboxStatus.SENT,
          sentAt: { gte: day },
        },
      }),
      prisma.emailOutbox.count({
        where: { organizationId, status: EmailOutboxStatus.FAILED },
      }),
      prisma.sequenceEnrollment.count({
        where: {
          organizationId,
          source: SequenceEnrollmentSource.AUTOPILOT,
          createdAt: { gte: day },
        },
      }),
      mailboxPoolService.list(organizationId),
      prisma.emailSuppression.count({ where: { organizationId } }),
      prisma.emailOutbox.count({
        where: {
          organizationId,
          status: EmailOutboxStatus.QUEUED,
          OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
        },
      }),
      prisma.emailOutbox.count({
        where: {
          organizationId,
          status: EmailOutboxStatus.QUEUED,
          scheduledFor: { gt: now },
        },
      }),
      prisma.emailEvent.count({
        where: {
          organizationId,
          type: EmailEventType.OPENED,
          occurredAt: { gte: day },
        },
      }),
      prisma.emailEvent.count({
        where: {
          organizationId,
          type: EmailEventType.CLICKED,
          occurredAt: { gte: day },
        },
      }),
    ]);

    const heldTimezone = await prisma.emailOutbox.count({
      where: {
        organizationId,
        status: EmailOutboxStatus.HELD,
        heldReason: "timezone_needed",
      },
    });

    const nextQueued = await prisma.emailOutbox.findFirst({
      where: {
        organizationId,
        status: EmailOutboxStatus.QUEUED,
        scheduledFor: { not: null },
      },
      orderBy: { scheduledFor: "asc" },
      select: { scheduledFor: true },
    });

    return {
      config,
      queued,
      held,
      heldTimezone,
      sentToday,
      failed,
      enrolledToday,
      mailboxes,
      suppressCount,
      globalCap: config.dailyGlobalCap,
      dueNow,
      waitingForWindow,
      nextScheduledFor: nextQueued?.scheduledFor?.toISOString() ?? null,
      openedToday,
      clickedToday,
    };
  }

  /** Outbox rows for the Outreach hub (Scheduled = queued/held, Sent = sent/failed). */
  async listOutbox(
    organizationId: string,
    kind: "scheduled" | "sent",
    take = 50
  ) {
    const statuses =
      kind === "scheduled"
        ? [EmailOutboxStatus.QUEUED, EmailOutboxStatus.HELD]
        : [EmailOutboxStatus.SENT, EmailOutboxStatus.FAILED];
    const rows = await prisma.emailOutbox.findMany({
      where: { organizationId, status: { in: statuses } },
      orderBy:
        kind === "scheduled"
          ? [{ scheduledFor: "asc" }, { createdAt: "asc" }]
          : [{ sentAt: "desc" }, { createdAt: "desc" }],
      take,
      select: {
        id: true,
        status: true,
        stepOrder: true,
        toEmail: true,
        subject: true,
        scheduledFor: true,
        sentAt: true,
        heldReason: true,
        lastError: true,
        shadowMode: true,
        createdAt: true,
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true } },
        emailAccount: { select: { email: true } },
      },
    });
    return rows;
  }

  async autoEnrollBatch(organizationId: string, limit = 5, userId?: string) {
    const config = await this.getConfig(organizationId);
    if (!config.physicalAddress.trim() || !config.businessName.trim()) {
      throw new ValidationError(
        "Set business name + physical address in Outbound settings before enrolling"
      );
    }

    await this.ensureColdOutreachSequence(organizationId);
    await this.ensureInboundOutreachSequence(organizationId);
    const coldSequence = await this.ensureColdOutreachSequence(organizationId);
    const inboundSequence =
      await this.ensureInboundOutreachSequence(organizationId);
    const picked = await mailboxPoolService.pickMailboxWithReasons(
      organizationId
    );
    const mailbox = picked.mailbox;
    if (!mailbox) {
      const detail =
        picked.reasons.length > 0
          ? picked.reasons.join(" · ")
          : "No active outbound mailbox with remaining daily capacity / valid DNS";
      throw new ValidationError(detail);
    }

    const pitches = await prisma.pitch.findMany({
      where: {
        organizationId,
        status: PitchStatus.APPROVED,
      },
      orderBy: { approvedAt: "asc" },
      take: Math.min(50, limit * 5),
      include: {
        contact: true,
        company: true,
        opportunity: { include: { source: true } },
      },
    });

    const results: Array<{
      pitchId: string;
      status: string;
      reason?: string;
      enrollmentId?: string;
    }> = [];

    for (const pitch of pitches) {
      if (results.filter((r) => r.status === "enrolled").length >= limit) break;

      const check = await this.eligibilityCheck(organizationId, pitch, config);
      if (!check.ok) {
        results.push({
          pitchId: pitch.id,
          status: "skipped",
          reason: check.reason,
        });
        continue;
      }

      // Never re-enroll a contact that already went through Autopilot outreach
      // (including completed) — that was causing duplicate sends of the same pitch.
      const priorEnrollment = await prisma.sequenceEnrollment.findFirst({
        where: {
          organizationId,
          contactId: pitch.contactId,
          source: SequenceEnrollmentSource.AUTOPILOT,
        },
        select: { id: true, status: true },
      });
      if (priorEnrollment) {
        results.push({
          pitchId: pitch.id,
          status: "skipped",
          reason: `already_enrolled:${priorEnrollment.status.toLowerCase()}`,
        });
        // Pitch already used — stop it showing up in Enroll now forever
        await prisma.pitch.updateMany({
          where: {
            id: pitch.id,
            organizationId,
            status: PitchStatus.APPROVED,
          },
          data: { status: PitchStatus.SUPERSEDED },
        });
        continue;
      }

      const alreadySent = await prisma.emailOutbox.findFirst({
        where: {
          organizationId,
          contactId: pitch.contactId,
          status: EmailOutboxStatus.SENT,
        },
        select: { id: true },
      });
      if (alreadySent) {
        results.push({
          pitchId: pitch.id,
          status: "skipped",
          reason: "already_sent",
        });
        await prisma.pitch.updateMany({
          where: {
            id: pitch.id,
            organizationId,
            status: PitchStatus.APPROVED,
          },
          data: { status: PitchStatus.SUPERSEDED },
        });
        continue;
      }

      try {
        const inbound =
          isInboundSourceKey(pitch.opportunity?.source?.key) ||
          isInboundSourceKey(pitch.company.source) ||
          String(pitch.company.source || "")
            .toUpperCase()
            .includes("META");
        const sequence = inbound ? inboundSequence : coldSequence;

        const enrollment = await sequenceEnrollmentService.enroll(
          organizationId,
          {
            sequenceId: sequence.id,
            contactId: pitch.contactId,
            opportunityId: pitch.opportunityId,
            source: SequenceEnrollmentSource.AUTOPILOT,
            enrolledById: userId ?? mailbox.emailAccount.userId,
            emailAccountId: mailbox.emailAccountId,
            startImmediately: true,
          }
        );

        // SOURCED → NEW
        if (pitch.opportunityId) {
          await prisma.opportunity.updateMany({
            where: {
              id: pitch.opportunityId,
              organizationId,
              stage: OpportunityStage.SOURCED,
            },
            data: { stage: OpportunityStage.NEW },
          });
        }

        await this.queueStep(organizationId, enrollment.id, config);

        // Consume the pitch so Enroll now cannot pick it again
        await prisma.pitch.updateMany({
          where: {
            id: pitch.id,
            organizationId,
            status: PitchStatus.APPROVED,
          },
          data: { status: PitchStatus.SUPERSEDED },
        });

        await timelineService.record({
          organizationId,
          companyId: pitch.companyId,
          contactId: pitch.contactId,
          opportunityId: pitch.opportunityId,
          type: CompanyTimelineEventType.CONTACTED,
          title: inbound
            ? "Enrolled in Inbound outreach (autopilot)"
            : "Enrolled in Cold outreach (autopilot)",
          details: {
            enrollmentId: enrollment.id,
            shadowMode: config.shadowMode,
            sequence: sequence.name,
          },
          actor: TimelineActor.SYSTEM,
          userId: userId ?? null,
          dedupeKey: `enrolled:${enrollment.id}`,
        });

        results.push({
          pitchId: pitch.id,
          status: "enrolled",
          enrollmentId: enrollment.id,
        });
      } catch (err) {
        results.push({
          pitchId: pitch.id,
          status: "error",
          reason: err instanceof Error ? err.message : "enroll failed",
        });
      }
    }

    const enrolled = results.filter((r) => r.status === "enrolled").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    return {
      /** Successfully enrolled count (not total pitches examined) */
      processed: enrolled,
      enrolled,
      skipped,
      examined: results.length,
      results,
    };
  }

  async eligibilityCheck(
    organizationId: string,
    pitch: {
      contactId: string;
      companyId: string;
      contact: {
        email: string | null;
        emailStatus: string | null;
      };
      company: {
        country: string | null;
        enrichmentStatus: string | null;
        auditStatus: string | null;
        timezone: string | null;
        source?: string | null;
      };
      opportunity?: {
        source?: { key: string } | null;
      } | null;
    },
    config: OutboundConfig
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    if (
      isInboundSourceKey(pitch.opportunity?.source?.key) ||
      isInboundSourceKey(pitch.company.source)
    ) {
      return { ok: false, reason: "inbound_lead" };
    }
    if (pitch.company.enrichmentStatus === "SKIPPED") {
      return { ok: false, reason: "company_skipped" };
    }
    if (pitch.company.auditStatus !== CompanyAuditStatus.DONE) {
      return { ok: false, reason: "not_audited" };
    }
    if (
      !isEnrollableVerification(
        (pitch.contact.emailStatus || "unknown") as EmailVerificationStatus,
        config.allowAcceptAll
      )
    ) {
      return { ok: false, reason: "email_not_enrollable" };
    }
    if (!pitch.contact.email) return { ok: false, reason: "no_email" };

    if (!isCountryAllowed(pitch.company.country, config.countryAllowList)) {
      return { ok: false, reason: "country_blocked" };
    }

    const suppressed = await emailSafetyService.isSuppressed(
      organizationId,
      pitch.contact.email
    );
    if (suppressed) return { ok: false, reason: "suppressed" };

    return { ok: true };
  }

  /** Build + insert outbox row for current enrollment step. */
  async queueStep(
    organizationId: string,
    enrollmentId: string,
    config?: OutboundConfig
  ) {
    const cfg = config ?? (await this.getConfig(organizationId));
    const enrollment = await prisma.sequenceEnrollment.findFirst({
      where: { id: enrollmentId, organizationId },
      include: {
        contact: { include: { company: true } },
        opportunity: {
          include: {
            company: true,
            recommendedService: true,
          },
        },
        sequence: { include: { steps: { orderBy: { stepOrder: "asc" } } } },
        organization: true,
        emailAccount: true,
      },
    });
    if (!enrollment) throw new ValidationError("Enrollment not found");
    if (enrollment.source !== SequenceEnrollmentSource.AUTOPILOT) {
      throw new ValidationError("queueStep is for AUTOPILOT enrollments only");
    }

    const steps = resolveEnrollmentSteps(enrollment);
    const step = steps.find(
      (s) => s.stepOrder === enrollment.currentStepOrder && s.isActive
    );
    if (!step) return null;

    const idempotencyKey = enrollmentStepIdempotencyKey(
      enrollment.id,
      step.stepOrder
    );
    const existing = await prisma.emailOutbox.findUnique({
      where: { idempotencyKey },
    });
    // Allow rebuild when previously held for fixable reasons (or cancelled)
    const rebuildHeld =
      existing?.status === EmailOutboxStatus.HELD &&
      (existing.heldReason === "timezone_needed" ||
        existing.heldReason === "missing_approved_pitch");
    if (
      existing &&
      !rebuildHeld &&
      existing.status !== EmailOutboxStatus.CANCELLED
    ) {
      return existing;
    }
    if (existing) {
      await prisma.emailOutbox.delete({ where: { id: existing.id } });
    }

    const company =
      enrollment.opportunity?.company ?? enrollment.contact.company;
    // Enroll marks the pitch SUPERSEDED so it won't re-enroll — still use it to send
    const pitch = await prisma.pitch.findFirst({
      where: {
        organizationId,
        contactId: enrollment.contactId,
        status: { in: [PitchStatus.APPROVED, PitchStatus.SUPERSEDED] },
      },
      orderBy: [{ approvedAt: "desc" }, { updatedAt: "desc" }],
    });

    // Always BRANDED HTML template — never queue/send plain-text outreach.
    const emailStyle = "BRANDED" as const;

    const vars = buildSequenceTemplateVars({
      contact: enrollment.contact,
      company,
      opportunity: enrollment.opportunity,
      organization: enrollment.organization,
      service: enrollment.opportunity?.recommendedService,
      pitch: pitch
        ? {
            personalizedFirstLine: pitch.personalizedFirstLine,
            shortPitch: pitch.shortPitch,
            topIssue: pitch.findingTitle || pitch.topIssue,
            recommendedService: pitch.recommendedService,
            greeting: pitch.greeting,
            introHtml: pitch.introHtml,
            findingTitle: pitch.findingTitle,
            findingText: pitch.findingText,
            bodyHtml: pitch.bodyHtml,
            preheader: pitch.preheader,
          }
        : null,
    });

    const subjectRendered = renderSequenceTemplateDetailed(
      step.subjectTemplate || "Quick idea for {{company_name}}",
      vars,
      REQUIRED_PITCH_VARS
    );

    const heldBase = {
      id: randomUUID(),
      organizationId,
      enrollmentId: enrollment.id,
      stepOrder: step.stepOrder,
      contactId: enrollment.contactId,
      companyId: company?.id ?? null,
      opportunityId: enrollment.opportunityId,
      emailAccountId: enrollment.emailAccountId!,
      status: EmailOutboxStatus.HELD,
      toEmail: enrollment.contact.email!,
      subject: subjectRendered.text,
      bodyText: "",
      idempotencyKey,
      shadowMode: cfg.shadowMode,
    };

    if (!pitch) {
      return prisma.emailOutbox.create({
        data: {
          ...heldBase,
          bodyText: "(missing approved pitch)",
          heldReason: "missing_approved_pitch",
        },
      });
    }

    const missingSubject = subjectRendered.missingRequired;
    if (missingSubject.length) {
      return prisma.emailOutbox.create({
        data: {
          ...heldBase,
          bodyText: "(missing template vars)",
          heldReason: `missing_vars:${missingSubject.join(",")}`,
        },
      });
    }

    const resolvedTz = resolveOutboundTimezone({
      timezone: company?.timezone,
      country: company?.country,
      fallbackTimezone:
        enrollment.organization.timezone || "Asia/Karachi",
    });
    const tz = resolvedTz.timezone;

    // Persist so future steps / UI don't show "need timezone"
    if (
      company?.id &&
      resolvedTz.from !== "company" &&
      company.timezone !== tz
    ) {
      await prisma.company.update({
        where: { id: company.id },
        data: { timezone: tz },
      });
    }

    if (!isCountryAllowed(company?.country, cfg.countryAllowList)) {
      return prisma.emailOutbox.create({
        data: {
          ...heldBase,
          bodyText: "(country blocked)",
          heldReason: "country_blocked",
        },
      });
    }

    const pool = await prisma.outboundMailbox.findFirst({
      where: {
        organizationId,
        emailAccountId: enrollment.emailAccountId!,
      },
    });

    const fromCheck = assertOutboundFromAllowed({
      fromEmail: enrollment.emailAccount?.email || "",
      allowFreeMailProvider: pool?.allowFreeMailProvider === true,
    });
    if (!fromCheck.ok) {
      return prisma.emailOutbox.create({
        data: {
          ...heldBase,
          bodyText: fromCheck.reason,
          heldReason: "free_mail_blocked",
          outboundMailboxId: pool?.id ?? null,
        },
      });
    }

    const unsub = unsubscribeUrl(organizationId, enrollment.contact.email!);
    const sender = await emailBrandingService.resolveForSend(
      organizationId,
      pool?.id
    );
    const outboxId = randomUUID();

    let rendered;
    try {
      rendered = renderOutboundEmail({
        style: emailStyle,
        subject: subjectRendered.text,
        pitch: {
          greeting: pitch.greeting,
          introHtml: pitch.introHtml,
          findingTitle: pitch.findingTitle,
          findingText: pitch.findingText,
          bodyHtml: pitch.bodyHtml,
          preheader: pitch.preheader,
          personalizedFirstLine: pitch.personalizedFirstLine,
          shortPitch: pitch.shortPitch,
          topIssue: pitch.topIssue,
        },
        contact: {
          firstName: enrollment.contact.firstName,
          email: enrollment.contact.email,
        },
        company: {
          name: company?.name,
          domain: company?.domain,
        },
        sender,
        unsubscribeUrl: unsub,
        track: {
          organizationId,
          outboxId,
          campaign: "cold_outreach",
        },
      });
    } catch (err) {
      return prisma.emailOutbox.create({
        data: {
          ...heldBase,
          bodyText: err instanceof Error ? err.message : "render failed",
          heldReason: "render_failed",
          outboundMailboxId: pool?.id ?? null,
        },
      });
    }

    // BRANDED only — compliance/unsub live in the HTML template
    const bodyText = rendered.text;

    // Thread follow-ups to prior sent message
    let threadMeta: Record<string, unknown> = {};
    if (step.stepOrder > 1) {
      const prior = await prisma.emailOutbox.findFirst({
        where: {
          enrollmentId: enrollment.id,
          organizationId,
          status: EmailOutboxStatus.SENT,
          stepOrder: { lt: step.stepOrder },
        },
        orderBy: { stepOrder: "desc" },
        select: {
          messageId: true,
          providerMessageId: true,
          subject: true,
          metadata: true,
        },
      });
      if (prior?.providerMessageId || prior?.messageId) {
        const ref =
          prior.providerMessageId || prior.messageId || undefined;
        threadMeta = {
          inReplyTo: ref,
          references: ref,
          threadSubject: prior.subject,
        };
      }
    }

    const scheduledFor = nextSendWindowUtc(tz);

    return prisma.emailOutbox.create({
      data: {
        id: outboxId,
        organizationId,
        enrollmentId: enrollment.id,
        stepOrder: step.stepOrder,
        contactId: enrollment.contactId,
        companyId: company?.id ?? null,
        opportunityId: enrollment.opportunityId,
        emailAccountId: enrollment.emailAccountId!,
        outboundMailboxId: pool?.id ?? null,
        status: EmailOutboxStatus.QUEUED,
        toEmail: enrollment.contact.email!,
        subject: rendered.subject,
        bodyText,
        bodyHtml: rendered.html,
        scheduledFor,
        idempotencyKey,
        shadowMode: cfg.shadowMode,
        metadata: {
          unsubscribeUrl: unsub,
          emailStyle,
          timezone: tz,
          timezoneSource: resolvedTz.from,
          tracked: true,
          ...threadMeta,
          headers: {
            ...buildListUnsubscribeHeaders({
              unsubscribeUrl: unsub,
              mailtoEmail: enrollment.emailAccount?.email,
            }),
            ...(threadMeta.inReplyTo
              ? {
                  "In-Reply-To": `<${String(threadMeta.inReplyTo)}>`,
                  References: `<${String(threadMeta.references)}>`,
                }
              : {}),
          },
        } as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Rebuild outbox rows stuck on fixable holds (timezone / pitch after SUPERSEDED).
   * Called from manual Process outbox.
   */
  async releaseFixableHolds(organizationId: string, limit = 25) {
    const held = await prisma.emailOutbox.findMany({
      where: {
        organizationId,
        purpose: EmailOutboxPurpose.SEQUENCE,
        status: EmailOutboxStatus.HELD,
        heldReason: {
          in: ["timezone_needed", "missing_approved_pitch"],
        },
        enrollmentId: { not: null },
      },
      take: limit,
      select: { id: true, enrollmentId: true, heldReason: true },
    });
    let released = 0;
    for (const row of held) {
      if (!row.enrollmentId) continue;
      try {
        const out = await this.queueStep(organizationId, row.enrollmentId);
        if (out && out.status === EmailOutboxStatus.QUEUED) released += 1;
      } catch (err) {
        console.warn(
          "[outbound] releaseFixableHolds failed",
          row.id,
          row.heldReason,
          err instanceof Error ? err.message : err
        );
      }
    }
    return { held: held.length, released };
  }

  async processOutboxBatch(
    organizationId: string,
    limit = 5,
    opts?: { bypassSchedule?: boolean }
  ) {
    // Manual Process outbox: unblock fixable holds first (timezone / pitch)
    if (opts?.bypassSchedule) {
      await this.releaseFixableHolds(organizationId, limit);
    }

    const config = await this.getConfig(organizationId);
    const day = startOfUtcDay();
    const now = new Date();
    const sentToday = await prisma.emailOutbox.count({
      where: {
        organizationId,
        purpose: EmailOutboxPurpose.SEQUENCE,
        status: EmailOutboxStatus.SENT,
        sentAt: { gte: day },
      },
    });
    if (sentToday >= config.dailyGlobalCap) {
      return {
        processed: 0,
        results: [],
        reason: "global_cap" as const,
        waitingForWindow: 0,
        nextScheduledFor: null as string | null,
      };
    }

    const remaining = config.dailyGlobalCap - sentToday;
    const take = Math.min(limit, remaining, config.maxSendPerTick);

    const scheduleFilter = opts?.bypassSchedule
      ? {}
      : {
          OR: [
            { scheduledFor: null },
            { scheduledFor: { lte: now } },
          ],
        };

    const due = await prisma.emailOutbox.findMany({
      where: {
        organizationId,
        purpose: EmailOutboxPurpose.SEQUENCE,
        status: EmailOutboxStatus.QUEUED,
        ...scheduleFilter,
      },
      orderBy: { scheduledFor: "asc" },
      take,
      include: {
        enrollment: true,
        contact: true,
        company: true,
        emailAccount: true,
      },
    });

    const waitingForWindow = opts?.bypassSchedule
      ? 0
      : await prisma.emailOutbox.count({
          where: {
            organizationId,
            status: EmailOutboxStatus.QUEUED,
            scheduledFor: { gt: now },
          },
        });

    const nextWaiting = opts?.bypassSchedule
      ? null
      : await prisma.emailOutbox.findFirst({
          where: {
            organizationId,
            status: EmailOutboxStatus.QUEUED,
            scheduledFor: { gt: now },
          },
          orderBy: { scheduledFor: "asc" },
          select: { scheduledFor: true },
        });

    if (due.length === 0) {
      const stillHeld = await prisma.emailOutbox.count({
        where: {
          organizationId,
          purpose: EmailOutboxPurpose.SEQUENCE,
          status: EmailOutboxStatus.HELD,
        },
      });
      return {
        processed: 0,
        results: [],
        reason:
          waitingForWindow > 0
            ? ("waiting_for_window" as const)
            : stillHeld > 0
              ? ("held_not_queued" as const)
              : ("nothing_due" as const),
        waitingForWindow,
        held: stillHeld,
        nextScheduledFor: nextWaiting?.scheduledFor?.toISOString() ?? null,
      };
    }

    const results = [];
    for (const item of due) {
      results.push(await this.sendOutboxItem(organizationId, item.id, config));
      // 2–6 min gap is encoded in scheduledFor for next picks; small pause between in-tick sends
    }
    return {
      processed: results.length,
      results,
      waitingForWindow,
      nextScheduledFor: nextWaiting?.scheduledFor?.toISOString() ?? null,
    };
  }

  async sendOutboxItem(
    organizationId: string,
    outboxId: string,
    config?: OutboundConfig
  ) {
    const cfg = config ?? (await this.getConfig(organizationId));

    const claimed = await prisma.emailOutbox.updateMany({
      where: {
        id: outboxId,
        organizationId,
        // AI_REPLY rows are delivered only by aiReplyService.flushDueReplies
        purpose: EmailOutboxPurpose.SEQUENCE,
        status: EmailOutboxStatus.QUEUED,
      },
      data: { status: EmailOutboxStatus.SENDING, attemptCount: { increment: 1 } },
    });
    if (claimed.count === 0) {
      return { id: outboxId, status: "skipped", reason: "not_queued" };
    }

    const item = await prisma.emailOutbox.findFirst({
      where: { id: outboxId, organizationId },
      include: {
        enrollment: true,
        contact: true,
        company: true,
        emailAccount: true,
      },
    });
    if (!item) return { id: outboxId, status: "error", reason: "missing" };

    // Re-check country + suppression at send
    if (!isCountryAllowed(item.company?.country, cfg.countryAllowList)) {
      await prisma.emailOutbox.update({
        where: { id: outboxId },
        data: {
          status: EmailOutboxStatus.HELD,
          heldReason: "country_blocked",
        },
      });
      return { id: outboxId, status: "held", reason: "country_blocked" };
    }

    const suppressed = await emailSafetyService.isSuppressed(
      organizationId,
      item.toEmail
    );
    if (suppressed) {
      await prisma.emailOutbox.update({
        where: { id: outboxId },
        data: { status: EmailOutboxStatus.CANCELLED, lastError: "suppressed" },
      });
      return { id: outboxId, status: "cancelled", reason: "suppressed" };
    }

    // Always rebuild BRANDED HTML at send time so the designed template ships
    // even if the row was queued as plain (legacy) or before a deploy.
    let bodyText = item.bodyText;
    let bodyHtml = item.bodyHtml;
    const isSequence =
      item.purpose === EmailOutboxPurpose.SEQUENCE ||
      item.enrollmentId != null;
    const wantsBranded = isSequence;
    const htmlLooksBranded =
      typeof bodyHtml === "string" &&
      (bodyHtml.includes("WHAT WE NOTICED") ||
        bodyHtml.includes("SOFTWARE STUDIO"));
    if (wantsBranded) {
      try {
        const rebuilt = await this.reRenderBrandedOutbox(organizationId, item);
        if (rebuilt) {
          bodyText = rebuilt.text;
          bodyHtml = rebuilt.html;
          await prisma.emailOutbox.update({
            where: { id: outboxId },
            data: {
              bodyText,
              bodyHtml,
              subject: rebuilt.subject,
              metadata: {
                ...(typeof item.metadata === "object" && item.metadata
                  ? (item.metadata as object)
                  : {}),
                emailStyle: "BRANDED",
                reRenderedAt: new Date().toISOString(),
              } as Prisma.InputJsonValue,
            },
          });
        } else if (!htmlLooksBranded) {
          await prisma.emailOutbox.update({
            where: { id: outboxId },
            data: {
              status: EmailOutboxStatus.HELD,
              heldReason: "render_failed",
              lastError: "branded re-render returned null (missing pitch?)",
            },
          });
          return {
            id: outboxId,
            status: "held",
            reason: "render_failed",
          };
        }
      } catch (err) {
        console.error(
          "[outbound] branded re-render failed",
          err instanceof Error ? err.message : err
        );
        if (!htmlLooksBranded) {
          await prisma.emailOutbox.update({
            where: { id: outboxId },
            data: {
              status: EmailOutboxStatus.HELD,
              heldReason: "render_failed",
              lastError: (
                err instanceof Error ? err.message : "branded render failed"
              ).slice(0, 500),
            },
          });
          return {
            id: outboxId,
            status: "held",
            reason: "render_failed",
          };
        }
      }
    }

    // Never send sequence mail as plain-looking HTML.
    if (
      wantsBranded &&
      (typeof bodyHtml !== "string" ||
        (!bodyHtml.includes("WHAT WE NOTICED") &&
          !bodyHtml.includes("SOFTWARE STUDIO")))
    ) {
      await prisma.emailOutbox.update({
        where: { id: outboxId },
        data: {
          status: EmailOutboxStatus.HELD,
          heldReason: "render_failed",
          lastError: "refusing to send non-branded HTML for sequence email",
        },
      });
      return { id: outboxId, status: "held", reason: "render_failed" };
    }

    if (cfg.shadowMode || item.shadowMode) {
      await prisma.emailOutbox.update({
        where: { id: outboxId },
        data: {
          status: EmailOutboxStatus.SENT,
          sentAt: new Date(),
          metadata: {
            ...(typeof item.metadata === "object" && item.metadata
              ? (item.metadata as object)
              : {}),
            shadow: true,
          } as Prisma.InputJsonValue,
        },
      });
      if (item.outboundMailboxId) {
        await mailboxPoolService.recordSend(item.outboundMailboxId);
      }
      await this.afterSuccessfulSend(item, true);
      return { id: outboxId, status: "sent_shadow" };
    }

    try {
      const meta =
        item.metadata && typeof item.metadata === "object"
          ? (item.metadata as {
              headers?: Record<string, string>;
              inReplyTo?: string;
              references?: string;
            })
          : {};

      const sent = await inboxService.sendOutreach({
        organizationId,
        userId: item.emailAccount.userId,
        emailAccountId: item.emailAccountId,
        toEmail: item.toEmail,
        subject: item.subject,
        body: bodyText,
        bodyHtml: bodyHtml ?? bodyText,
        companyId: item.companyId,
        contactId: item.contactId,
        opportunityId: item.opportunityId,
        idempotencyKey: item.idempotencyKey,
        headers: meta.headers,
        inReplyTo: meta.inReplyTo,
        references: meta.references,
      });

      await prisma.emailOutbox.update({
        where: { id: outboxId },
        data: {
          status: EmailOutboxStatus.SENT,
          sentAt: new Date(),
          messageId: sent.message.id,
          providerMessageId: sent.message.providerMessageId,
          metadata: {
            ...meta,
            headers: meta.headers,
            providerThreadId: sent.message.threadId ?? null,
          } as Prisma.InputJsonValue,
        },
      });

      if (item.outboundMailboxId) {
        await mailboxPoolService.recordSend(item.outboundMailboxId);
      }

      if (item.enrollmentId != null && item.stepOrder != null) {
        await prisma.sequenceEnrollmentExecution.upsert({
          where: { idempotencyKey: item.idempotencyKey },
          create: {
            organizationId,
            enrollmentId: item.enrollmentId,
            stepOrder: item.stepOrder,
            status: SequenceExecutionStatus.SUCCESS,
            messageId: sent.message.id,
            idempotencyKey: item.idempotencyKey,
          },
          update: {
            status: SequenceExecutionStatus.SUCCESS,
            messageId: sent.message.id,
          },
        });
      }

      await this.afterSuccessfulSend(item, false);
      return { id: outboxId, status: "sent" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "send failed";
      await prisma.emailOutbox.update({
        where: { id: outboxId },
        data: {
          status: EmailOutboxStatus.FAILED,
          lastError: message.slice(0, 500),
        },
      });
      return { id: outboxId, status: "failed", reason: message };
    }
  }

  /** Rebuild BRANDED HTML for a queued outbox row that was stored as plain text. */
  private async reRenderBrandedOutbox(
    organizationId: string,
    item: {
      id: string;
      contactId: string;
      companyId: string | null;
      outboundMailboxId: string | null;
      toEmail: string;
      subject: string;
      contact: {
        firstName: string | null;
        email: string | null;
      } | null;
      company: { name: string; domain: string | null } | null;
    }
  ) {
    const pitch = await prisma.pitch.findFirst({
      where: {
        organizationId,
        contactId: item.contactId,
        status: { in: [PitchStatus.APPROVED, PitchStatus.SUPERSEDED] },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (!pitch) return null;

    const unsub = unsubscribeUrl(organizationId, item.toEmail);
    const sender = await emailBrandingService.resolveForSend(
      organizationId,
      item.outboundMailboxId
    );
    return renderOutboundEmail({
      style: "BRANDED",
      subject: item.subject,
      pitch: {
        greeting: pitch.greeting,
        introHtml: pitch.introHtml,
        findingTitle: pitch.findingTitle,
        findingText: pitch.findingText,
        bodyHtml: pitch.bodyHtml,
        preheader: pitch.preheader,
        personalizedFirstLine: pitch.personalizedFirstLine,
        shortPitch: pitch.shortPitch,
        topIssue: pitch.topIssue,
      },
      contact: {
        firstName: item.contact?.firstName,
        email: item.contact?.email ?? item.toEmail,
      },
      company: {
        name: item.company?.name,
        domain: item.company?.domain,
      },
      sender,
      unsubscribeUrl: unsub,
      track: {
        organizationId,
        outboxId: item.id,
        campaign: "cold_outreach",
      },
    });
  }

  private async afterSuccessfulSend(
    item: {
      organizationId: string;
      enrollmentId: string | null;
      stepOrder: number | null;
      companyId: string | null;
      contactId: string;
      opportunityId: string | null;
    },
    shadow: boolean
  ) {
    // AI replies use purpose=AI_REPLY and have no enrollment — skip sequence advance
    if (item.enrollmentId == null || item.stepOrder == null) return;

    const enrollmentId = item.enrollmentId;
    const stepOrder = item.stepOrder;

    // CONTACTED after first send
    if (item.opportunityId && stepOrder <= 1) {
      await prisma.opportunity.updateMany({
        where: {
          id: item.opportunityId,
          organizationId: item.organizationId,
          stage: { in: [OpportunityStage.SOURCED, OpportunityStage.NEW] },
        },
        data: { stage: OpportunityStage.CONTACTED },
      });
    }

    if (item.companyId) {
      await timelineService.record({
        organizationId: item.organizationId,
        companyId: item.companyId,
        contactId: item.contactId,
        opportunityId: item.opportunityId,
        type: CompanyTimelineEventType.CONTACTED,
        title: shadow
          ? `Shadow send step ${stepOrder} (not delivered)`
          : `Email sent (step ${stepOrder})`,
        details: { enrollmentId, shadow },
        actor: TimelineActor.SYSTEM,
        dedupeKey: `outbox_sent:${enrollmentId}:${stepOrder}`,
      });
    }

    // Advance enrollment + queue next step
    const enrollment = await prisma.sequenceEnrollment.findFirst({
      where: { id: enrollmentId },
      include: {
        sequence: { include: { steps: { orderBy: { stepOrder: "asc" } } } },
      },
    });
    if (!enrollment) return;

    const steps = resolveEnrollmentSteps(enrollment);
    const next = steps.find(
      (s) => s.stepOrder > stepOrder && s.isActive
    );
    if (!next) {
      await prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: SequenceEnrollmentStatus.COMPLETED,
          completedAt: new Date(),
          nextRunAt: null,
          lastExecutedAt: new Date(),
        },
      });
      return;
    }

    await prisma.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: SequenceEnrollmentStatus.ACTIVE,
        currentStepOrder: next.stepOrder,
        lastExecutedAt: new Date(),
        nextRunAt: new Date(
          Date.now() + Math.max(0, next.delayMinutes) * 60_000
        ),
      },
    });

    // Queue next step immediately as HELD/QUEUED with schedule; delay handled via scheduledFor + delayMinutes
    await this.queueStep(item.organizationId, enrollment.id);
  }

  async processTickForOrg(organizationId: string) {
    const config = await this.getConfig(organizationId);
    if (!config.enabled) {
      return { skipped: true, reason: "outbound_off" as const };
    }
    const enroll = await this.autoEnrollBatch(
      organizationId,
      config.maxEnrollPerTick
    ).catch((e) => ({
      processed: 0,
      results: [],
      error: e instanceof Error ? e.message : "enroll failed",
    }));
    const send = await this.processOutboxBatch(
      organizationId,
      config.maxSendPerTick
    );
    return { skipped: false, enroll, send };
  }

  async processAllEnabled() {
    const settings = await prisma.organizationSettings.findMany({
      select: { organizationId: true, settings: true },
    });
    const results = [];
    for (const row of settings) {
      const cfg = await outboundConfigService.getConfig(row.organizationId);
      if (!cfg.enabled) continue;
      results.push({
        organizationId: row.organizationId,
        ...(await this.processTickForOrg(row.organizationId)),
      });
    }
    return { orgs: results.length, results };
  }
}

export const outboundJobService = new OutboundJobService();
