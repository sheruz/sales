import {
  EmailOutboxStatus,
  EmailStyle,
  OutreachSequenceStatus,
  SequenceEnrollmentSource,
  SequenceEnrollmentStatus,
} from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { ValidationError, ForbiddenError } from "@/lib/api/response";
import { organizationService } from "@/services/organization.service";
import { emailAccountService } from "@/services/email-account.service";
import { mailboxPoolService } from "@/services/mailbox-pool.service";
import { emailSafetyService } from "@/services/email-safety.service";
import { outboundJobService } from "@/services/outbound-job.service";
import { sequenceEnrollmentService } from "@/services/sequence-enrollment.service";
import {
  getPlatformOutreachSendEnabled,
  setPlatformOutreachSendEnabled,
} from "@/lib/platform/outreach-send-gate";
import {
  assertBusinessAddress,
  caslBlocksCanadian,
  cooldownCutoff,
  excludedAsClientOrDnc,
  fillPlatformTemplate,
  hasWebsite,
  isActiveEnrollmentStatus,
  resolvePlatformOutreachTimezone,
} from "@/lib/platform/outreach-eligibility";
import { nextSendWindowUtc } from "@/lib/outbound/timezone";

function ownerOrgId(): string {
  const id = env.PLATFORM_OWNER_ORG_ID;
  if (!id) {
    throw new ValidationError(
      "PLATFORM_OWNER_ORG_ID is not configured — cannot use Super Admin Outreach"
    );
  }
  return id;
}

export class PlatformOutreachService {
  ownerOrgId() {
    return ownerOrgId();
  }

  async getSendEnabled() {
    return getPlatformOutreachSendEnabled();
  }

  async setSendEnabled(enabled: boolean, actorUserId: string, reason?: string) {
    const before = await getPlatformOutreachSendEnabled();
    await setPlatformOutreachSendEnabled(enabled, actorUserId);
    await organizationService.writePlatformAudit({
      actorUserId,
      action: "platform_outreach.send_toggle",
      targetType: "platform_setting",
      targetId: "platform_outreach_send_enabled",
      organizationId: ownerOrgId(),
      before: { enabled: before },
      after: { enabled },
      reason,
    });
    return { enabled };
  }

  async requireAddressOrThrow() {
    const cfg = await outboundJobService.getConfig(ownerOrgId());
    const check = assertBusinessAddress(cfg.physicalAddress);
    if (!check.ok) {
      throw new ValidationError(check.message || "Business address required");
    }
    return cfg;
  }

  // ── Templates ──────────────────────────────────────────────

  async listTemplates() {
    return prisma.platformOutreachTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  async createTemplate(input: {
    key?: string;
    name: string;
    category: string;
    subject: string;
    bodyText: string;
    actorUserId: string;
  }) {
    const key =
      input.key?.trim() ||
      input.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .slice(0, 64);
    const row = await prisma.platformOutreachTemplate.create({
      data: {
        key,
        name: input.name.trim(),
        category: input.category,
        subject: input.subject,
        bodyText: input.bodyText,
      },
    });
    await organizationService.writePlatformAudit({
      actorUserId: input.actorUserId,
      action: "platform_outreach.template_create",
      targetType: "platform_outreach_template",
      targetId: row.id,
      organizationId: ownerOrgId(),
      after: { key, name: row.name },
    });
    return row;
  }

  async updateTemplate(
    id: string,
    input: Partial<{
      name: string;
      category: string;
      subject: string;
      bodyText: string;
      active: boolean;
      sortOrder: number;
    }>,
    actorUserId: string
  ) {
    const row = await prisma.platformOutreachTemplate.update({
      where: { id },
      data: {
        ...(input.name != null ? { name: input.name.trim() } : {}),
        ...(input.category != null ? { category: input.category } : {}),
        ...(input.subject != null ? { subject: input.subject } : {}),
        ...(input.bodyText != null ? { bodyText: input.bodyText } : {}),
        ...(input.active != null ? { active: input.active } : {}),
        ...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
      },
    });
    await organizationService.writePlatformAudit({
      actorUserId,
      action: "platform_outreach.template_update",
      targetType: "platform_outreach_template",
      targetId: id,
      organizationId: ownerOrgId(),
    });
    return row;
  }

  async duplicateTemplate(id: string, actorUserId: string) {
    const src = await prisma.platformOutreachTemplate.findUnique({
      where: { id },
    });
    if (!src) throw new ValidationError("Template not found");
    return this.createTemplate({
      key: `${src.key}_copy_${Date.now().toString(36)}`,
      name: `${src.name} (copy)`,
      category: src.category,
      subject: src.subject,
      bodyText: src.bodyText,
      actorUserId,
    });
  }

  async previewTemplate(templateId: string, contactId: string) {
    const orgId = ownerOrgId();
    const [tpl, contact, cfg] = await Promise.all([
      prisma.platformOutreachTemplate.findUnique({ where: { id: templateId } }),
      prisma.contact.findFirst({
        where: { id: contactId, organizationId: orgId },
        include: { company: true },
      }),
      outboundJobService.getConfig(orgId),
    ]);
    if (!tpl) throw new ValidationError("Template not found");
    if (!contact) throw new ValidationError("Contact not found in Default Workspace");
    const subject = fillPlatformTemplate({
      template: tpl.subject,
      firstName: contact.firstName,
      companyName: contact.company.name,
      website: contact.company.website || contact.company.domain,
      city: contact.company.city,
      businessAddress: cfg.physicalAddress,
      originalSubject: tpl.subject,
    });
    const bodyText = fillPlatformTemplate({
      template: tpl.bodyText,
      firstName: contact.firstName,
      companyName: contact.company.name,
      website: contact.company.website || contact.company.domain,
      city: contact.company.city,
      businessAddress: cfg.physicalAddress,
      originalSubject: subject,
    });
    return { subject, bodyText, contact, template: tpl };
  }

  // ── Accounts (Default Workspace) ───────────────────────────

  async listAccounts() {
    const orgId = ownerOrgId();
    const [accounts, mailboxes] = await Promise.all([
      emailAccountService.list(orgId),
      mailboxPoolService.list(orgId).catch(() => []),
    ]);
    return { accounts, mailboxes, organizationId: orgId };
  }

  async testAccount(mailboxId: string, actorUserId: string) {
    const orgId = ownerOrgId();
    const result = await mailboxPoolService.sendTestToSelf(
      orgId,
      mailboxId,
      actorUserId
    );
    await organizationService.writePlatformAudit({
      actorUserId,
      action: "platform_outreach.account_test",
      targetType: "outbound_mailbox",
      targetId: mailboxId,
      organizationId: orgId,
    });
    return result;
  }

  // ── Eligibility ────────────────────────────────────────────

  async evaluateContact(contactId: string) {
    const orgId = ownerOrgId();
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId },
      include: { company: true },
    });
    if (!contact) return { ok: false as const, reason: "no_email" as const };
    if (!contact.email?.trim()) {
      return { ok: false as const, reason: "no_email" as const };
    }

    if (
      excludedAsClientOrDnc({
        companyMetadata: contact.company.metadata,
        contactMetadata: contact.metadata,
        contactStatus: contact.status,
      })
    ) {
      return { ok: false as const, reason: "client_or_dnc" as const };
    }

    const suppressed = await emailSafetyService.isSuppressed(
      orgId,
      contact.email
    );
    if (suppressed) {
      return { ok: false as const, reason: "suppressed" as const };
    }

    if (
      caslBlocksCanadian({
        emailSource: contact.emailSource,
        companyCountry: contact.company.country,
        metadata: contact.metadata,
      })
    ) {
      return { ok: false as const, reason: "casl_unpublished" as const };
    }

    const active = await prisma.sequenceEnrollment.findFirst({
      where: {
        organizationId: orgId,
        contactId: contact.id,
        status: { in: [...Object.values(SequenceEnrollmentStatus)].filter(
          (s) => isActiveEnrollmentStatus(s)
        ) as SequenceEnrollmentStatus[] },
      },
      select: { id: true, status: true },
    });
    if (active) {
      return { ok: false as const, reason: "active_enrollment" as const };
    }

    const recent = await prisma.emailOutbox.findFirst({
      where: {
        organizationId: orgId,
        contactId: contact.id,
        status: EmailOutboxStatus.SENT,
        sentAt: { gte: cooldownCutoff() },
      },
      select: { id: true },
    });
    if (recent) {
      return { ok: false as const, reason: "cooldown_30d" as const };
    }

    return {
      ok: true as const,
      hasWebsite: hasWebsite(contact.company),
      contact,
    };
  }

  // ── Campaigns ──────────────────────────────────────────────

  async listCampaigns() {
    return prisma.platformOutreachCampaign.findMany({
      where: { organizationId: ownerOrgId() },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { recipients: true } },
      },
    });
  }

  async getCampaign(id: string) {
    const c = await prisma.platformOutreachCampaign.findFirst({
      where: { id, organizationId: ownerOrgId() },
      include: {
        recipients: { orderBy: { createdAt: "asc" }, take: 200 },
      },
    });
    if (!c) throw new ValidationError("Campaign not found");
    return c;
  }

  async createCampaign(input: {
    name: string;
    actorUserId: string;
    sendCap?: number;
    followUpDelayDays?: number;
    emailAccountId?: string | null;
    rotateAccounts?: boolean;
    hasWebsiteTemplateId?: string | null;
    noWebsiteTemplateId?: string | null;
    followUpTemplateId?: string | null;
  }) {
    const orgId = ownerOrgId();
    const templates = await this.listTemplates();
    const hasTpl =
      input.hasWebsiteTemplateId ||
      templates.find((t) => t.key === "first_touch_has_website")?.id ||
      null;
    const noTpl =
      input.noWebsiteTemplateId ||
      templates.find((t) => t.key === "first_touch_no_website")?.id ||
      null;
    const followTpl =
      input.followUpTemplateId ||
      templates.find((t) => t.key === "follow_up_day_4")?.id ||
      null;

    const row = await prisma.platformOutreachCampaign.create({
      data: {
        organizationId: orgId,
        name: input.name.trim(),
        sendCap: input.sendCap ?? 50,
        followUpDelayDays: input.followUpDelayDays ?? 4,
        emailAccountId: input.emailAccountId ?? null,
        rotateAccounts: Boolean(input.rotateAccounts),
        hasWebsiteTemplateId: hasTpl,
        noWebsiteTemplateId: noTpl,
        followUpTemplateId: followTpl,
        createdByUserId: input.actorUserId,
      },
    });
    await organizationService.writePlatformAudit({
      actorUserId: input.actorUserId,
      action: "platform_outreach.campaign_create",
      targetType: "platform_outreach_campaign",
      targetId: row.id,
      organizationId: orgId,
      after: { name: row.name },
    });
    return row;
  }

  async pauseCampaign(id: string, actorUserId: string) {
    const orgId = ownerOrgId();
    const c = await prisma.platformOutreachCampaign.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!c) throw new ValidationError("Campaign not found");
    const row = await prisma.platformOutreachCampaign.update({
      where: { id },
      data: { status: "PAUSED", pausedAt: new Date() },
    });
    if (c.hasWebsiteSequenceId) {
      await prisma.outreachSequence.updateMany({
        where: { id: c.hasWebsiteSequenceId, organizationId: orgId },
        data: { pausedAt: new Date(), pauseReason: "platform_campaign_paused" },
      });
    }
    if (c.noWebsiteSequenceId) {
      await prisma.outreachSequence.updateMany({
        where: { id: c.noWebsiteSequenceId, organizationId: orgId },
        data: { pausedAt: new Date(), pauseReason: "platform_campaign_paused" },
      });
    }
    await organizationService.writePlatformAudit({
      actorUserId,
      action: "platform_outreach.campaign_pause",
      targetType: "platform_outreach_campaign",
      targetId: id,
      organizationId: orgId,
    });
    return row;
  }

  async buildReview(input: {
    campaignId: string;
    contactIds: string[];
    actorUserId: string;
  }) {
    const orgId = ownerOrgId();
    const cfg = await this.requireAddressOrThrow();
    const campaign = await this.getCampaign(input.campaignId);
    const [hasTpl, noTpl] = await Promise.all([
      campaign.hasWebsiteTemplateId
        ? prisma.platformOutreachTemplate.findUnique({
            where: { id: campaign.hasWebsiteTemplateId },
          })
        : null,
      campaign.noWebsiteTemplateId
        ? prisma.platformOutreachTemplate.findUnique({
            where: { id: campaign.noWebsiteTemplateId },
          })
        : null,
    ]);
    if (!hasTpl || !noTpl) {
      throw new ValidationError("Campaign templates missing — seed templates first");
    }

    const results: Array<{
      contactId: string;
      status: string;
      skipReason?: string;
      subject?: string;
      bodyText?: string;
      templateKind?: string;
    }> = [];

    for (const contactId of input.contactIds.slice(0, campaign.sendCap)) {
      const ev = await this.evaluateContact(contactId);
      if (!ev.ok) {
        await prisma.platformOutreachCampaignRecipient.upsert({
          where: {
            campaignId_contactId: {
              campaignId: campaign.id,
              contactId,
            },
          },
          create: {
            campaignId: campaign.id,
            contactId,
            templateKind: "skipped",
            subject: "",
            bodyText: "",
            status: "SKIPPED",
            skipReason: ev.reason,
          },
          update: {
            status: "SKIPPED",
            skipReason: ev.reason,
          },
        });
        results.push({
          contactId,
          status: "SKIPPED",
          skipReason: ev.reason,
        });
        continue;
      }

      const kind = ev.hasWebsite ? "has_website" : "no_website";
      const tpl = kind === "has_website" ? hasTpl : noTpl;
      const subject = fillPlatformTemplate({
        template: tpl.subject,
        firstName: ev.contact.firstName,
        companyName: ev.contact.company.name,
        website: ev.contact.company.website || ev.contact.company.domain,
        city: ev.contact.company.city,
        businessAddress: cfg.physicalAddress,
      });
      const bodyText = fillPlatformTemplate({
        template: tpl.bodyText,
        firstName: ev.contact.firstName,
        companyName: ev.contact.company.name,
        website: ev.contact.company.website || ev.contact.company.domain,
        city: ev.contact.company.city,
        businessAddress: cfg.physicalAddress,
        originalSubject: subject,
      });

      await prisma.platformOutreachCampaignRecipient.upsert({
        where: {
          campaignId_contactId: {
            campaignId: campaign.id,
            contactId,
          },
        },
        create: {
          campaignId: campaign.id,
          contactId,
          companyId: ev.contact.companyId,
          templateKind: kind,
          subject,
          bodyText,
          status: "READY",
          skipReason: null,
        },
        update: {
          companyId: ev.contact.companyId,
          templateKind: kind,
          subject,
          bodyText,
          status: "READY",
          skipReason: null,
          edited: false,
        },
      });
      results.push({
        contactId,
        status: "READY",
        subject,
        bodyText,
        templateKind: kind,
      });
    }

    await organizationService.writePlatformAudit({
      actorUserId: input.actorUserId,
      action: "platform_outreach.campaign_review",
      targetType: "platform_outreach_campaign",
      targetId: campaign.id,
      organizationId: orgId,
      after: {
        ready: results.filter((r) => r.status === "READY").length,
        skipped: results.filter((r) => r.status === "SKIPPED").length,
      },
    });

    return { campaignId: campaign.id, results };
  }

  async updateRecipient(
    campaignId: string,
    contactId: string,
    patch: { subject?: string; bodyText?: string }
  ) {
    const orgId = ownerOrgId();
    const campaign = await prisma.platformOutreachCampaign.findFirst({
      where: { id: campaignId, organizationId: orgId },
    });
    if (!campaign) throw new ValidationError("Campaign not found");
    return prisma.platformOutreachCampaignRecipient.update({
      where: {
        campaignId_contactId: { campaignId, contactId },
      },
      data: {
        ...(patch.subject != null ? { subject: patch.subject } : {}),
        ...(patch.bodyText != null ? { bodyText: patch.bodyText } : {}),
        edited: true,
      },
    });
  }

  private async ensureCampaignSequences(campaignId: string) {
    const orgId = ownerOrgId();
    const campaign = await this.getCampaign(campaignId);
    const [hasTpl, noTpl, followTpl] = await Promise.all([
      campaign.hasWebsiteTemplateId
        ? prisma.platformOutreachTemplate.findUnique({
            where: { id: campaign.hasWebsiteTemplateId },
          })
        : null,
      campaign.noWebsiteTemplateId
        ? prisma.platformOutreachTemplate.findUnique({
            where: { id: campaign.noWebsiteTemplateId },
          })
        : null,
      campaign.followUpTemplateId
        ? prisma.platformOutreachTemplate.findUnique({
            where: { id: campaign.followUpTemplateId },
          })
        : null,
    ]);
    if (!hasTpl || !noTpl || !followTpl) {
      throw new ValidationError("Missing templates for campaign sequences");
    }

    const delay = Math.max(1, campaign.followUpDelayDays) * 24 * 60;

    async function upsertSeq(
      existingId: string | null,
      name: string,
      first: { subject: string; body: string },
      follow: { subject: string; body: string }
    ) {
      if (existingId) {
        const existing = await prisma.outreachSequence.findFirst({
          where: { id: existingId, organizationId: orgId },
        });
        if (existing) return existing.id;
      }
      const seq = await prisma.outreachSequence.create({
        data: {
          organizationId: orgId,
          name,
          description: `Platform Outreach campaign ${campaignId}`,
          status: OutreachSequenceStatus.ACTIVE,
          stopOnReply: true,
          stopOnUnsubscribe: true,
          steps: {
            create: [
              {
                stepOrder: 1,
                delayMinutes: 0,
                subjectTemplate: first.subject,
                bodyTemplate: first.body,
                emailStyle: EmailStyle.PLAIN,
              },
              {
                stepOrder: 2,
                delayMinutes: delay,
                subjectTemplate: follow.subject,
                bodyTemplate: follow.body,
                emailStyle: EmailStyle.PLAIN,
              },
            ],
          },
        },
      });
      return seq.id;
    }

    // Use placeholder tokens in sequence steps; recipient body is written to outbox via custom path.
    // For enroll/queue we store filled subject/body on recipient and write PLAIN outbox directly.
    const hasSeqId = await upsertSeq(
      campaign.hasWebsiteSequenceId,
      `Platform Outreach · Has website · ${campaign.name}`,
      { subject: hasTpl.subject, body: hasTpl.bodyText },
      { subject: followTpl.subject, body: followTpl.bodyText }
    );
    const noSeqId = await upsertSeq(
      campaign.noWebsiteSequenceId,
      `Platform Outreach · No website · ${campaign.name}`,
      { subject: noTpl.subject, body: noTpl.bodyText },
      { subject: followTpl.subject, body: followTpl.bodyText }
    );

    return prisma.platformOutreachCampaign.update({
      where: { id: campaignId },
      data: {
        hasWebsiteSequenceId: hasSeqId,
        noWebsiteSequenceId: noSeqId,
      },
    });
  }

  async launchCampaign(input: {
    campaignId: string;
    mode: "now" | "window";
    actorUserId: string;
  }) {
    const orgId = ownerOrgId();
    if (!(await getPlatformOutreachSendEnabled())) {
      throw new ForbiddenError(
        "Outreach sending is OFF. Turn it on in Super Admin → Outreach."
      );
    }
    const cfg = await this.requireAddressOrThrow();
    let campaign = await this.getCampaign(input.campaignId);
    if (campaign.status === "PAUSED") {
      throw new ValidationError("Campaign is paused");
    }
    campaign = await this.ensureCampaignSequences(campaign.id);

    const ready = await prisma.platformOutreachCampaignRecipient.findMany({
      where: { campaignId: campaign.id, status: "READY" },
      take: Math.max(0, campaign.sendCap - campaign.sentCount),
      orderBy: { createdAt: "asc" },
    });

    let sent = 0;
    const errors: Array<{ contactId: string; error: string }> = [];

    for (const recip of ready) {
      if (campaign.sentCount + sent >= campaign.sendCap) break;

      const daily = await emailSafetyService.assertOrgDailyLimit(orgId);
      if (!daily.ok) {
        errors.push({ contactId: recip.contactId, error: daily.reason });
        break;
      }

      const recheck = await this.evaluateContact(recip.contactId);
      if (!recheck.ok) {
        await prisma.platformOutreachCampaignRecipient.update({
          where: { id: recip.id },
          data: { status: "SKIPPED", skipReason: recheck.reason },
        });
        continue;
      }

      const sequenceId =
        recip.templateKind === "has_website"
          ? campaign.hasWebsiteSequenceId!
          : campaign.noWebsiteSequenceId!;

      try {
        let emailAccountId = campaign.emailAccountId;
        if (!emailAccountId) {
          const mb = await prisma.outboundMailbox.findFirst({
            where: { organizationId: orgId, pausedAt: null },
            orderBy: { createdAt: "asc" },
            select: { emailAccountId: true },
          });
          emailAccountId = mb?.emailAccountId ?? null;
        }
        if (!emailAccountId) {
          throw new ValidationError(
            "No outreach mailbox on Default Workspace — connect an account first"
          );
        }

        // AUTOPILOT source → EmailOutbox path (executor skips). platformOutreach metadata unlocks PLAIN queue.
        const enrollment = await sequenceEnrollmentService.enroll(orgId, {
          sequenceId,
          contactId: recip.contactId,
          source: SequenceEnrollmentSource.AUTOPILOT,
          enrolledById: input.actorUserId,
          emailAccountId,
          metadata: {
            platformOutreach: true,
            campaignId: campaign.id,
            recipientId: recip.id,
            filledSubject: recip.subject,
            filledBody: recip.bodyText,
            businessAddress: cfg.physicalAddress,
          },
        });

        const outbox = await outboundJobService.queueStep(orgId, enrollment.id);

        if (outbox?.id && input.mode === "now") {
          await prisma.emailOutbox.update({
            where: { id: outbox.id },
            data: {
              subject: recip.subject,
              bodyText: recip.bodyText,
              scheduledFor: new Date(),
              status:
                outbox.status === EmailOutboxStatus.HELD
                  ? outbox.status
                  : EmailOutboxStatus.QUEUED,
            },
          });
        } else if (outbox?.id && input.mode === "window") {
          const tz = resolvePlatformOutreachTimezone({
            timezone: recheck.contact.company.timezone,
            city: recheck.contact.company.city,
            country: recheck.contact.company.country,
          });
          const when = nextSendWindowUtc(tz, new Date()) ?? new Date();
          await prisma.emailOutbox.update({
            where: { id: outbox.id },
            data: {
              scheduledFor: when,
              subject: recip.subject,
              bodyText: recip.bodyText,
            },
          });
        }

        await prisma.platformOutreachCampaignRecipient.update({
          where: { id: recip.id },
          data: {
            status: "QUEUED",
            enrollmentId: enrollment.id,
            outboxId: outbox?.id ?? null,
          },
        });
        sent += 1;
      } catch (err) {
        errors.push({
          contactId: recip.contactId,
          error: err instanceof Error ? err.message : "enroll failed",
        });
        await prisma.platformOutreachCampaignRecipient.update({
          where: { id: recip.id },
          data: {
            status: "FAILED",
            skipReason:
              err instanceof Error ? err.message.slice(0, 200) : "failed",
          },
        });
      }
    }

    const updated = await prisma.platformOutreachCampaign.update({
      where: { id: campaign.id },
      data: {
        status: "ACTIVE",
        sentCount: { increment: sent },
        scheduledMode: input.mode,
      },
    });

    // Drain due outbox for "now" mode (respects limits / holds)
    if (input.mode === "now" && sent > 0) {
      await outboundJobService.processOutboxBatch(orgId, Math.min(sent, 10), {
        manual: true,
      });
    }

    await organizationService.writePlatformAudit({
      actorUserId: input.actorUserId,
      action: "platform_outreach.campaign_launch",
      targetType: "platform_outreach_campaign",
      targetId: campaign.id,
      organizationId: orgId,
      after: { queued: sent, mode: input.mode, errors: errors.length },
    });

    return { campaign: updated, queued: sent, errors };
  }

  async searchContacts(opts: {
    q?: string;
    hasWebsite?: boolean | null;
    country?: string | null;
    limit?: number;
  }) {
    const orgId = ownerOrgId();
    const limit = Math.min(opts.limit ?? 50, 100);
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId: orgId,
        email: { not: null },
        status: "ACTIVE",
        ...(opts.q
          ? {
              OR: [
                { fullName: { contains: opts.q, mode: "insensitive" } },
                { email: { contains: opts.q, mode: "insensitive" } },
                { company: { name: { contains: opts.q, mode: "insensitive" } } },
              ],
            }
          : {}),
        ...(opts.country
          ? { company: { country: { equals: opts.country, mode: "insensitive" } } }
          : {}),
      },
      take: limit * 2,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            website: true,
            domain: true,
            country: true,
            city: true,
            metadata: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return contacts
      .filter((c) => {
        if (opts.hasWebsite == null) return true;
        return hasWebsite(c.company) === opts.hasWebsite;
      })
      .slice(0, limit)
      .map((c) => ({
        id: c.id,
        email: c.email,
        fullName: c.fullName,
        firstName: c.firstName,
        companyId: c.companyId,
        companyName: c.company.name,
        country: c.company.country,
        hasWebsite: hasWebsite(c.company),
      }));
  }
}

export const platformOutreachService = new PlatformOutreachService();
