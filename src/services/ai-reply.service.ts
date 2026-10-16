import prisma from "@/lib/db/prisma";
import {
  AiReplyStatus,
  CompanyTimelineEventType,
  ContactStatus,
  EmailEventType,
  EmailOutboxPurpose,
  EmailOutboxStatus,
  EmailStatus,
  InboxConversationStatus,
  MessageAiClassification,
  MessageDirection,
  OpportunityEventType,
  OpportunityStage,
  OpportunityStatus,
  Prisma,
  SuppressionReason,
  TaskPriority,
  TaskType,
  TimelineActor,
  type AiReplyDraft,
  type Company,
  type Contact,
  type EmailAccount,
  type EmailOutbox,
  type InboxConversation,
  type Message,
  type Opportunity,
} from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { aiComplete, parseAIJson } from "@/lib/ai/provider";
import type { AICompletionResult } from "@/lib/ai/types";
import { FEATURE_KEYS } from "@/lib/billing/features";
import { wrapUntrustedContent, sanitizeExternalForAI } from "@/lib/security/untrusted-content";
import type { AiReplyConfig } from "@/lib/ai-reply/config";
import {
  PHASE5_CLASSES,
  PHASE5_CLASS_TO_ENUM,
  applyConfidenceThreshold,
  enumToPhase5Slug,
  parsePhase5ClassRaw,
  type Phase5Class,
} from "@/lib/ai-reply/classes";
import {
  parseOooReturnDate,
  runDeterministicPrecheck,
  type InboundHeaders,
} from "@/lib/ai-reply/precheck";
import { detectHoldTriggers } from "@/lib/ai-reply/hold-triggers";
import {
  buildClassifySystemPrompt,
  buildDraftSystemPrompt,
  wrapInboundEmailForAI,
} from "@/lib/ai-reply/prompt";
import { nextAiReplySendAt, zonedParts } from "@/lib/ai-reply/timing";
import { validateAiReplyText } from "@/lib/ai-reply/validate-output";
import { aiReplyConfigService } from "@/services/ai-reply-config.service";
import { notificationService } from "@/services/notification.service";
import { timelineService } from "@/services/timeline.service";
import { businessBrainService } from "@/services/business-brain.service";
import { emailBrandingService } from "@/services/email-branding.service";
import { emailProviderService } from "@/services/email-provider.service";
import { emailSafetyService } from "@/services/email-safety.service";
import { entitlementService } from "@/services/entitlement.service";
import { outboundConfigService } from "@/services/outbound-config.service";
import { sequenceEnrollmentService } from "@/services/sequence-enrollment.service";
import { companyService } from "@/services/company.service";
import { normalizeEmail } from "@/services/contact.service";
import { contactEmailMatchWhere } from "@/lib/email/inbound-sync";
import { randomUUID } from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Inbound mail headers. `messageId` / `references` are optional extras for threading. */
export type AiReplyInboundHeaders = InboundHeaders & {
  /** RFC 5322 Message-ID of the inbound email (used for In-Reply-To) */
  messageId?: string | null;
  /** RFC 5322 References header of the inbound email */
  references?: string | null;
};

export type HandleInboundInput = {
  organizationId: string;
  userId?: string;
  message: Message;
  conversation: InboxConversation;
  contact?: Contact | null;
  company?: Company | null;
  opportunity?: Opportunity | null;
  headers?: AiReplyInboundHeaders | null;
};

export type HandleInboundResult = {
  outcome:
    | "ooo"
    | "unsubscribe"
    | "mode_off"
    | "existing_draft"
    | "no_reply_needed"
    | "held"
    | "drafted"
    | "queued"
    | "superseded"
    | "error";
  classification: MessageAiClassification | null;
  draft: AiReplyDraft | null;
  /** True when the sequence was stopped (reply) — false for OOO (paused instead) */
  sequenceStopped: boolean;
  pausedForOooUntil: Date | null;
  error?: string;
};

type Ctx = {
  organizationId: string;
  userId?: string;
  cfg: AiReplyConfig;
  message: Message;
  conversation: InboxConversation;
  contact: Contact | null;
  company: Company | null;
  opportunity: Opportunity | null;
  headers: AiReplyInboundHeaders;
  /** Inbound body with quoted history stripped (used for precheck / hold triggers / AI) */
  cleanBody: string;
  subject: string;
  now: Date;
};

type Classification = {
  slug: Phase5Class;
  enumValue: MessageAiClassification;
  confidence: number;
  holdReason: string | null;
  reasoning: string;
  timeframe: string | null;
  referralName: string | null;
  referralEmail: string | null;
  oooReturnHint: string | null;
  model: string | null;
  cost: number;
  legacyClass: string | null;
  originalSlug: Phase5Class | null;
  failed: boolean;
};

type DraftText = {
  replyText: string;
  offersBooking: boolean;
  holdReason: string | null;
  confidence: number;
  model: string | null;
  cost: number;
};

type RawClassify = {
  class?: unknown;
  confidence?: unknown;
  hold_reason?: unknown;
  reasoning_summary?: unknown;
  timeframe?: unknown;
  referral_name?: unknown;
  referral_email?: unknown;
  ooo_return_hint?: unknown;
};

type RawDraft = {
  class?: unknown;
  confidence?: unknown;
  hold_reason?: unknown;
  reply_text?: unknown;
  offers_booking?: unknown;
};

type DeliverStatus =
  | "sent"
  | "cancelled"
  | "held"
  | "failed"
  | "retry"
  | "skipped";

type DeliverResult = {
  status: DeliverStatus;
  reason?: string;
  outboxId: string;
  messageId?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

const DRAFTABLE: ReadonlySet<Phase5Class> = new Set<Phase5Class>([
  "interested",
  "question",
  "not_now",
  "wrong_person",
  "not_interested",
]);

const AUTO_SEND_CLASSES: ReadonlySet<Phase5Class> = new Set<Phase5Class>([
  "interested",
  "question",
  "not_now",
]);

const STAGE_RANK: Record<OpportunityStage, number> = {
  SOURCED: 0,
  NEW: 1,
  QUALIFIED: 2,
  CONTACTED: 3,
  REPLIED: 4,
  POSITIVE_REPLY: 5,
  DISCOVERY: 6,
  MEETING: 7,
  PROPOSAL: 8,
  NEGOTIATION: 9,
  WON: 10,
  LOST: 11,
};

const FLUSH_BATCH = 20;
const MAX_SEND_ATTEMPTS = 3;
const DIGEST_TZ = "Asia/Karachi";
const DIGEST_HOUR = 9;
const DEFAULT_OOO_DAYS = 7;
const MAX_OOO_DAYS = 60;
const DEFAULT_NOT_NOW_DAYS = 60;
const EMAIL_RE = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+$/;
const PLACEHOLDER_RE = /\[[^\]\n]{1,60}\]|\{\{[^}\n]+\}\}/;

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function asJson(v: Record<string, unknown>): Prisma.InputJsonValue {
  return v as Prisma.InputJsonValue;
}

function clamp01(n: unknown, fallback = 0): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(1, Math.max(0, x));
}

function str(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Remove quoted reply history so we classify only what the prospect wrote. */
export function stripQuotedReply(body: string): string {
  const lines = (body || "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^On .{5,200}wrote:\s*$/i.test(t)) break;
    if (/^-{2,}\s*(original message|forwarded message)/i.test(t)) break;
    if (/^_{5,}$/.test(t)) break;
    if (/^From:\s.+/i.test(t) && out.length > 0) break;
    if (t.startsWith(">")) continue;
    out.push(line);
  }
  const cleaned = out.join("\n").trim();
  return cleaned || (body || "").trim();
}

function normalizeSubject(subject: string | null | undefined): string {
  const s = (subject || "").trim();
  if (!s) return "Re: your message";
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

function toRfcMessageId(raw: string | null | undefined): string | null {
  const t = (raw || "").trim();
  if (!t) return null;
  const bare = t.replace(/^<|>$/g, "");
  // Gmail / Graph ids are not RFC Message-IDs — require an "@"
  if (!bare.includes("@")) return null;
  return `<${bare}>`;
}

function extractCost(result: AICompletionResult): number {
  const r = result as AICompletionResult & {
    costUsd?: number;
    cost?: number;
    metadata?: { costUsd?: number };
  };
  const c = r.costUsd ?? r.cost ?? r.metadata?.costUsd;
  return typeof c === "number" && Number.isFinite(c) && c >= 0 ? c : 0;
}

/** Parse "in 3 weeks", "next quarter", "Q1", "after March" … → due date (default +60d). */
export function parseTimeframeToDate(
  timeframe: string | null | undefined,
  now = new Date()
): Date {
  const DAY = 86_400_000;
  const t = (timeframe || "").toLowerCase().trim();
  const clampDays = (d: number) => Math.min(365, Math.max(7, Math.round(d)));
  const at = (days: number) => new Date(now.getTime() + clampDays(days) * DAY);
  if (!t) return at(DEFAULT_NOT_NOW_DAYS);

  const words: Record<string, number> = {
    a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, couple: 2, few: 3,
  };
  const rel = t.match(
    /\b(\d{1,3}|a|an|one|two|three|four|five|six|couple|few)(?:\s+of)?\s*(day|week|month|year)s?\b/
  );
  if (rel) {
    const n = /^\d/.test(rel[1]) ? Number(rel[1]) : words[rel[1]] ?? 1;
    const unit = rel[2];
    const days = unit === "day" ? n : unit === "week" ? n * 7 : unit === "month" ? n * 30 : n * 365;
    return at(days);
  }

  if (/next week/.test(t)) return at(7);
  if (/next month/.test(t)) return at(30);
  if (/next quarter/.test(t)) return at(90);
  if (/next year|new year|after the holidays/.test(t)) {
    const y = now.getUTCMonth() === 0 ? now.getUTCFullYear() : now.getUTCFullYear() + 1;
    const d = new Date(Date.UTC(y, 0, 6, 9));
    return at((d.getTime() - now.getTime()) / DAY);
  }
  if (/end of (the )?year|year[- ]end/.test(t)) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), 11, 1, 9));
    const days = (d.getTime() - now.getTime()) / DAY;
    return at(days > 7 ? days : 30);
  }

  const q = t.match(/\bq([1-4])\b/);
  if (q) {
    const month = (Number(q[1]) - 1) * 3;
    let d = new Date(Date.UTC(now.getUTCFullYear(), month, 1, 9));
    if (d.getTime() - now.getTime() < 7 * DAY) {
      d = new Date(Date.UTC(now.getUTCFullYear() + 1, month, 1, 9));
    }
    return at((d.getTime() - now.getTime()) / DAY);
  }

  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ];
  const mi = months.findIndex((m) => t.includes(m));
  if (mi >= 0) {
    let d = new Date(Date.UTC(now.getUTCFullYear(), mi, 1, 9));
    if (d.getTime() - now.getTime() < 7 * DAY) {
      d = new Date(Date.UTC(now.getUTCFullYear() + 1, mi, 1, 9));
    }
    return at((d.getTime() - now.getTime()) / DAY);
  }

  return at(DEFAULT_NOT_NOW_DAYS);
}

function startOfLocalDay(now: Date, timeZone: string): Date {
  const p = zonedParts(now, timeZone || "UTC");
  const elapsedMs = (p.hour * 60 + p.minute) * 60_000 + now.getUTCSeconds() * 1000 + now.getUTCMilliseconds();
  return new Date(now.getTime() - elapsedMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class AiReplyService {
  // ───────────────────────────── handleInbound ─────────────────────────────

  /**
   * Called by inbox.service right after an INBOUND message row is created.
   * Never throws — failures are logged and returned as outcome "error"
   * (the human-reply sequence stop is applied first, so it is never skipped).
   */
  async handleInbound(input: HandleInboundInput): Promise<HandleInboundResult> {
    const base: HandleInboundResult = {
      outcome: "error",
      classification: null,
      draft: null,
      sequenceStopped: false,
      pausedForOooUntil: null,
    };

    try {
      if (input.message.direction !== MessageDirection.INBOUND) {
        return { ...base, outcome: "no_reply_needed" };
      }
      const ctx = await this.buildCtx(input);
      return await this.runInbound(ctx);
    } catch (err) {
      console.error("[ai-reply.handleInbound]", {
        organizationId: input.organizationId,
        messageId: input.message.id,
        error: errMsg(err),
      });
      // Airtight: a human replied → sequence must stop even if AI pipeline failed.
      const contactId = input.conversation.contactId ?? input.contact?.id;
      if (contactId) {
        try {
          await sequenceEnrollmentService.stopForContactReply(
            input.organizationId,
            contactId
          );
        } catch {
          /* already logged above */
        }
      }
      return { ...base, error: errMsg(err) };
    }
  }

  private async runInbound(ctx: Ctx): Promise<HandleInboundResult> {
    const { message, conversation, cfg } = ctx;
    const result: HandleInboundResult = {
      outcome: "no_reply_needed",
      classification: null,
      draft: null,
      sequenceStopped: false,
      pausedForOooUntil: null,
    };

    // b. Deterministic precheck — AI never decides OOO / unsubscribe-keyword cases.
    const pre = runDeterministicPrecheck({
      headers: ctx.headers,
      subject: ctx.subject,
      body: ctx.cleanBody,
      now: ctx.now,
    });

    if (pre.kind === "out_of_office") {
      const until = await this.applyOoo(ctx, pre.returnDate, pre.reasoning, {
        source: "precheck",
      });
      return {
        ...result,
        outcome: "ooo",
        classification: MessageAiClassification.OUT_OF_OFFICE,
        pausedForOooUntil: until,
      };
    }

    if (pre.kind === "unsubscribe") {
      await this.applyUnsubscribe(ctx, pre.reasoning, { source: "precheck" });
      return {
        ...result,
        outcome: "unsubscribe",
        classification: MessageAiClassification.UNSUBSCRIBE,
        sequenceStopped: true,
      };
    }

    // h. Human reply stops the sequence — before anything that can fail or take time.
    result.sequenceStopped = await this.stopSequence(ctx);

    // k. Idempotent: draft already exists for this inbound.
    const existing = await prisma.aiReplyDraft.findUnique({
      where: { inboundMessageId: message.id },
    });
    if (existing) {
      return {
        ...result,
        outcome: "existing_draft",
        classification: existing.class,
        draft: existing,
      };
    }

    // a. Newer inbound supersedes any not-yet-sent AI reply for this conversation.
    await this.cancelPendingForConversation(ctx, "superseded_by_newer_inbound");

    // Always reflect reply on the opportunity (REPLIED) + timeline, even if AI is off.
    await this.recordReplyReceived(ctx);
    await this.bumpOpportunity(ctx, OpportunityStage.REPLIED, OpportunityEventType.REPLIED, "Prospect replied");

    // c. Mode OFF → no AI work at all (legacy classifier in inbox still runs).
    if (cfg.mode === "OFF") {
      return { ...result, outcome: "mode_off" };
    }

    // d. Classify (economy tier).
    const cls = await this.classify(ctx);

    // AI-detected deterministic classes get the same treatment as the precheck.
    if (cls.slug === "out_of_office" && !cls.failed) {
      const hint = cls.oooReturnHint ? parseOooReturnDate(cls.oooReturnHint, ctx.now) : null;
      const until = await this.applyOoo(ctx, hint, cls.reasoning, { source: "ai", cls });
      return {
        ...result,
        outcome: "ooo",
        classification: MessageAiClassification.OUT_OF_OFFICE,
        pausedForOooUntil: until,
      };
    }
    if (cls.slug === "unsubscribe" && !cls.failed) {
      await this.applyUnsubscribe(ctx, cls.reasoning, { source: "ai", cls });
      return {
        ...result,
        outcome: "unsubscribe",
        classification: MessageAiClassification.UNSUBSCRIBE,
        sequenceStopped: true,
      };
    }

    // i. Hold triggers (low confidence already folded into cls → OTHER + hold).
    const holdFromClass = cls.holdReason;
    const holdFromTriggers = holdFromClass
      ? null
      : detectHoldTriggers(`${ctx.subject}\n${ctx.cleanBody}`, cfg.holdTriggers, {
          nonEnglishHold: cfg.nonEnglishHold,
        });
    let hold: string | null = holdFromClass ?? holdFromTriggers;

    // e. Persist classification on message + conversation.
    await this.persistClassification(ctx, cls, hold);

    // f. Timeline: REPLY_CLASSIFIED
    await this.recordClassified(ctx, cls, hold);

    // g. Opportunity updates.
    await this.applyOpportunityForClass(ctx, cls.slug, cls.reasoning);
    result.classification = cls.enumValue;

    // n. wrong_person + referral → contact (never emailed).
    let referralContact: Contact | null = null;
    if (cls.slug === "wrong_person" && cls.referralEmail) {
      referralContact = await this.createReferralContact(ctx, cls);
    }

    // o. not_now + timeframe → follow-up task.
    if (cls.slug === "not_now") {
      await this.createNotNowTask(ctx, cls);
    }

    // m. Max AI replies (SENT only) → hand off instead of drafting.
    const sentCount = await this.sentAiReplyCount(ctx.conversation.id);
    if (!hold && DRAFTABLE.has(cls.slug) && sentCount >= cfg.maxRepliesPerConversation) {
      hold = "max_replies_reached";
      await prisma.message.update({
        where: { id: message.id },
        data: { holdReason: hold },
      });
      await prisma.inboxConversation.update({
        where: { id: conversation.id },
        data: { holdReason: hold },
      });
    }

    // Decide whether a reply draft is wanted for this class.
    const wantsDraft = this.wantsDraft(cls, cfg, !!referralContact || !!cls.referralEmail);

    // Nothing to reply to and nothing needing a human → leave in inbox as NEEDS_ACTION.
    if (!wantsDraft && !hold) {
      return { ...result, outcome: "no_reply_needed" };
    }

    // j. Draft text (skipped when already on hold for reasons that make drafting pointless).
    let draftText: DraftText | null = null;
    let draftHold: string | null = null;
    const skipDrafting =
      !wantsDraft ||
      hold === "max_replies_reached" ||
      hold === "classification_failed" ||
      hold === "low_confidence";

    if (!skipDrafting) {
      const gen = await this.generateDraft(ctx, cls.slug, cls);
      draftText = gen.draft;
      draftHold = gen.holdReason;
    }
    hold = hold ?? draftHold;

    const persisted = await this.persistDraft(ctx, {
      existing: null,
      cls,
      replyText: draftText?.replyText ?? "",
      offersBooking: draftText?.offersBooking ?? false,
      holdReason: hold,
      draftModel: draftText?.model ?? null,
      draftCost: draftText?.cost ?? 0,
      allowAutoSend: true,
      referralContact,
    });

    return {
      ...result,
      outcome: persisted.outcome,
      draft: persisted.draft,
    };
  }

  // ───────────────────────────── context ─────────────────────────────

  private async buildCtx(input: HandleInboundInput): Promise<Ctx> {
    const conversation =
      (await prisma.inboxConversation.findFirst({
        where: { id: input.conversation.id, organizationId: input.organizationId },
      })) ?? input.conversation;

    const cfg = await aiReplyConfigService.getConfig(input.organizationId);

    let contact = input.contact ?? null;
    if (!contact && conversation.contactId) {
      contact = await prisma.contact.findFirst({
        where: { id: conversation.contactId, organizationId: input.organizationId },
      });
    }
    if (!contact && input.message.fromEmail) {
      contact = await prisma.contact.findFirst({
        where: contactEmailMatchWhere(
          input.organizationId,
          input.message.fromEmail
        ),
      });
    }

    let company = input.company ?? null;
    const companyId = conversation.companyId ?? contact?.companyId ?? null;
    if (!company && companyId) {
      company = await prisma.company.findFirst({
        where: { id: companyId, organizationId: input.organizationId },
      });
    }

    let opportunity = input.opportunity ?? null;
    if (!opportunity && conversation.opportunityId) {
      opportunity = await prisma.opportunity.findFirst({
        where: { id: conversation.opportunityId, organizationId: input.organizationId },
      });
    }

    const subject = input.message.subject ?? conversation.subject ?? "";
    return {
      organizationId: input.organizationId,
      userId: input.userId,
      cfg,
      message: input.message,
      conversation,
      contact,
      company,
      opportunity,
      headers: input.headers ?? { subject },
      cleanBody: stripQuotedReply(input.message.body ?? ""),
      subject,
      now: new Date(),
    };
  }

  /** Re-hydrate context from a stored draft (regenerate / reclassify / manual send). */
  private async ctxForDraft(draft: AiReplyDraft, userId?: string): Promise<Ctx> {
    const message = await prisma.message.findFirst({
      where: { id: draft.inboundMessageId, organizationId: draft.organizationId },
    });
    if (!message) throw new NotFoundError("Inbound message not found");
    const conversation = await prisma.inboxConversation.findFirst({
      where: { id: draft.conversationId, organizationId: draft.organizationId },
    });
    if (!conversation) throw new NotFoundError("Conversation not found");
    return this.buildCtx({
      organizationId: draft.organizationId,
      userId,
      message,
      conversation,
    });
  }

  // ───────────────────────── sequence / pending control ─────────────────────────

  private async stopSequence(ctx: Ctx): Promise<boolean> {
    const contactId = ctx.contact?.id ?? ctx.conversation.contactId;
    if (!contactId) return false;
    await sequenceEnrollmentService.stopForContactReply(ctx.organizationId, contactId);
    return true;
  }

  /** a. Cancel QUEUED AI_REPLY outbox + QUEUED/DRAFT drafts from earlier inbound messages. */
  private async cancelPendingForConversation(ctx: Ctx, reason: string) {
    const stale = await prisma.aiReplyDraft.findMany({
      where: {
        organizationId: ctx.organizationId,
        conversationId: ctx.conversation.id,
        inboundMessageId: { not: ctx.message.id },
        status: { in: [AiReplyStatus.QUEUED, AiReplyStatus.DRAFT] },
      },
      select: { id: true, outboxId: true },
    });

    await prisma.emailOutbox.updateMany({
      where: {
        organizationId: ctx.organizationId,
        purpose: EmailOutboxPurpose.AI_REPLY,
        status: EmailOutboxStatus.QUEUED,
        inboundMessage: { conversationId: ctx.conversation.id },
        inboundMessageId: { not: ctx.message.id },
      },
      data: { status: EmailOutboxStatus.CANCELLED, lastError: reason },
    });

    if (stale.length > 0) {
      await prisma.aiReplyDraft.updateMany({
        where: { id: { in: stale.map((d) => d.id) } },
        data: { status: AiReplyStatus.CANCELLED },
      });
    }
  }

  private async sentAiReplyCount(conversationId: string): Promise<number> {
    // aiReplyCount only increments on autonomous AI replies actually SENT.
    const conv = await prisma.inboxConversation.findUnique({
      where: { id: conversationId },
      select: { aiReplyCount: true },
    });
    return conv?.aiReplyCount ?? 0;
  }

  // ───────────────────────── deterministic branches ─────────────────────────

  private async applyOoo(
    ctx: Ctx,
    returnDate: Date | null,
    reasoning: string,
    opts: { source: "precheck" | "ai"; cls?: Classification }
  ): Promise<Date> {
    const now = ctx.now;
    const maxUntil = new Date(now.getTime() + MAX_OOO_DAYS * 86_400_000);
    let until: Date;
    if (returnDate) {
      // +1 day so we resume after they're actually back
      until = new Date(returnDate.getTime() + 86_400_000);
    } else {
      until = new Date(now.getTime() + DEFAULT_OOO_DAYS * 86_400_000);
    }
    if (until > maxUntil) until = maxUntil;
    if (until <= now) until = new Date(now.getTime() + 86_400_000);

    const cls: Classification =
      opts.cls ??
      this.deterministicClassification("out_of_office", reasoning, "deterministic-precheck");

    await this.persistClassification(ctx, cls, null, {
      oooUntil: until,
      oooReturnParsed: Boolean(returnDate),
      source: opts.source,
    });

    await prisma.inboxConversation.update({
      where: { id: ctx.conversation.id },
      data: { oooUntil: until },
    });

    const contactId = ctx.contact?.id ?? ctx.conversation.contactId;
    if (contactId) {
      await sequenceEnrollmentService.pauseUntilOoo(ctx.organizationId, contactId, until);
    }

    // NEVER AI-reply to OOO — also cancel anything pending for the conversation.
    await this.cancelPendingForConversation(ctx, "ooo_auto_reply");

    if (ctx.company) {
      await timelineService.record({
        organizationId: ctx.organizationId,
        companyId: ctx.company.id,
        contactId: ctx.contact?.id ?? null,
        opportunityId: ctx.opportunity?.id ?? null,
        type: CompanyTimelineEventType.REPLY_RECEIVED,
        title: "Out-of-office auto-reply received",
        details: { oooUntil: until.toISOString(), messageId: ctx.message.id },
        actor: TimelineActor.SYSTEM,
        dedupeKey: `reply_received:${ctx.message.id}`,
      });
      await timelineService.record({
        organizationId: ctx.organizationId,
        companyId: ctx.company.id,
        contactId: ctx.contact?.id ?? null,
        opportunityId: ctx.opportunity?.id ?? null,
        type: CompanyTimelineEventType.REPLY_CLASSIFIED,
        title: `Classified: out_of_office — sequence paused until ${until.toISOString().slice(0, 10)}`,
        details: { class: "out_of_office", source: opts.source, reasoning },
        actor: TimelineActor.SYSTEM,
        dedupeKey: `reply_classified:${ctx.message.id}`,
      });
    }
    return until;
  }

  private async applyUnsubscribe(
    ctx: Ctx,
    reasoning: string,
    opts: { source: "precheck" | "ai"; cls?: Classification }
  ) {
    const from = (ctx.message.fromEmail || "").trim().toLowerCase();

    const cls: Classification =
      opts.cls ??
      this.deterministicClassification("unsubscribe", reasoning, "deterministic-precheck");
    await this.persistClassification(ctx, cls, null, { source: opts.source }, true);

    if (from) {
      const already = await emailSafetyService.isSuppressed(ctx.organizationId, from);
      if (!already) {
        await emailSafetyService.suppress({
          organizationId: ctx.organizationId,
          email: from,
          reason: SuppressionReason.UNSUBSCRIBE,
          source: opts.source === "precheck" ? "ai_reply_precheck" : "ai_reply_classifier",
        });
      }
    }

    const contactId = ctx.contact?.id ?? ctx.conversation.contactId;
    if (contactId) {
      await sequenceEnrollmentService.stopForContactReply(ctx.organizationId, contactId);
      await sequenceEnrollmentService.stopForContactUnsubscribe(ctx.organizationId, contactId);
      await prisma.contact.updateMany({
        where: { id: contactId, organizationId: ctx.organizationId },
        data: { status: ContactStatus.UNSUBSCRIBED },
      });
      await prisma.emailOutbox.updateMany({
        where: {
          organizationId: ctx.organizationId,
          contactId,
          status: { in: [EmailOutboxStatus.QUEUED, EmailOutboxStatus.HELD] },
        },
        data: { status: EmailOutboxStatus.CANCELLED, lastError: "unsubscribed" },
      });
    }

    await this.cancelPendingForConversation(ctx, "unsubscribed");

    const hasEvent = await prisma.emailEvent.findFirst({
      where: { messageId: ctx.message.id, type: EmailEventType.UNSUBSCRIBED },
      select: { id: true },
    });
    if (!hasEvent) {
      await prisma.emailEvent.create({
        data: {
          organizationId: ctx.organizationId,
          messageId: ctx.message.id,
          conversationId: ctx.conversation.id,
          type: EmailEventType.UNSUBSCRIBED,
          recipientEmail: from || ctx.message.fromEmail || "unknown",
        },
      });
    }

    await prisma.inboxConversation.update({
      where: { id: ctx.conversation.id },
      data: { status: InboxConversationStatus.CLOSED, nextActionAt: null },
    });

    if (ctx.company) {
      await timelineService.record({
        organizationId: ctx.organizationId,
        companyId: ctx.company.id,
        contactId: ctx.contact?.id ?? null,
        opportunityId: ctx.opportunity?.id ?? null,
        type: CompanyTimelineEventType.REPLY_RECEIVED,
        title: "Unsubscribe reply received",
        details: { messageId: ctx.message.id },
        actor: TimelineActor.SYSTEM,
        dedupeKey: `reply_received:${ctx.message.id}`,
      });
      await timelineService.record({
        organizationId: ctx.organizationId,
        companyId: ctx.company.id,
        contactId: ctx.contact?.id ?? null,
        opportunityId: ctx.opportunity?.id ?? null,
        type: CompanyTimelineEventType.REPLY_CLASSIFIED,
        title: "Classified: unsubscribe — suppressed, sequence stopped",
        details: { class: "unsubscribe", source: opts.source, reasoning },
        actor: TimelineActor.SYSTEM,
        dedupeKey: `reply_classified:${ctx.message.id}`,
      });
    }
  }

  private deterministicClassification(
    slug: Phase5Class,
    reasoning: string,
    model: string
  ): Classification {
    return {
      slug,
      enumValue: PHASE5_CLASS_TO_ENUM[slug],
      confidence: 1,
      holdReason: null,
      reasoning,
      timeframe: null,
      referralName: null,
      referralEmail: null,
      oooReturnHint: null,
      model,
      cost: 0,
      legacyClass: null,
      originalSlug: null,
      failed: false,
    };
  }

  // ───────────────────────────── classification ─────────────────────────────

  /** aiComplete wrapper: BYOK userId first, then platform key when user has no integration. */
  private async callAi(
    ctx: Pick<Ctx, "organizationId" | "userId">,
    args: {
      feature: string;
      operation: string;
      system: string;
      user: string;
      temperature: number;
      maxTokens?: number;
      /** Per-task model override from aiReply config */
      model?: string;
    }
  ): Promise<AICompletionResult> {
    const run = (userId: string | undefined) =>
      aiComplete({
        feature: args.feature,
        operation: args.operation,
        organizationId: ctx.organizationId,
        userId,
        jsonMode: true,
        temperature: args.temperature,
        maxTokens: args.maxTokens,
        model: args.model?.trim() || undefined,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
      });
    try {
      return await run(ctx.userId);
    } catch (err) {
      if (ctx.userId && /No AI API key/i.test(errMsg(err))) {
        return run(undefined);
      }
      throw err;
    }
  }

  private async classify(ctx: Ctx): Promise<Classification> {
    const fail = (reason: string): Classification => ({
      slug: "other",
      enumValue: MessageAiClassification.OTHER,
      confidence: 0,
      holdReason: "classification_failed",
      reasoning: `Classification failed: ${reason}`.slice(0, 300),
      timeframe: null,
      referralName: null,
      referralEmail: null,
      oooReturnHint: null,
      model: null,
      cost: 0,
      legacyClass: null,
      originalSlug: null,
      failed: true,
    });

    let result: AICompletionResult;
    try {
      result = await this.callAi(ctx, {
        feature: "inbox_reply_classification",
        operation: "ai_reply_classify",
        system: buildClassifySystemPrompt(),
        user: wrapInboundEmailForAI(ctx.subject, ctx.cleanBody),
        temperature: 0.1,
        maxTokens: 400,
        model: ctx.cfg.classifyModel || undefined,
      });
    } catch (err) {
      return fail(errMsg(err));
    }

    let raw: RawClassify;
    try {
      raw = parseAIJson<RawClassify>(result.content);
    } catch {
      return { ...fail("invalid_json"), model: result.model ?? null, cost: extractCost(result) };
    }

    const rawClass = typeof raw.class === "string" ? raw.class : "";
    const slug = parsePhase5ClassRaw(rawClass);
    const canonical = (PHASE5_CLASSES as readonly string[]).includes(
      rawClass.trim().toLowerCase().replace(/\s+/g, "_")
    );
    const confidence = clamp01(raw.confidence, 0);
    const referralEmailRaw = str(raw.referral_email, 200)?.toLowerCase() ?? null;
    const sender = (ctx.message.fromEmail || "").toLowerCase();
    const referralEmail =
      referralEmailRaw &&
      EMAIL_RE.test(referralEmailRaw) &&
      referralEmailRaw !== sender
        ? referralEmailRaw
        : null;

    const gate = applyConfidenceThreshold(slug, confidence, ctx.cfg.confidenceThreshold);
    const finalSlug: Phase5Class = gate.slug;
    const originalSlug: Phase5Class | null = gate.originalSlug;
    const holdReason = gate.holdReason ?? str(raw.hold_reason, 200);

    return {
      slug: finalSlug,
      enumValue: PHASE5_CLASS_TO_ENUM[finalSlug],
      confidence,
      holdReason,
      reasoning: str(raw.reasoning_summary, 500) ?? "",
      timeframe: str(raw.timeframe, 120),
      referralName: str(raw.referral_name, 120),
      referralEmail,
      oooReturnHint: str(raw.ooo_return_hint, 120),
      model: result.model ?? null,
      cost: extractCost(result),
      legacyClass: canonical ? null : rawClass || null,
      originalSlug,
      failed: false,
    };
  }

  /** e. Store classification on Message + latest on conversation. */
  private async persistClassification(
    ctx: Ctx,
    cls: Classification,
    hold: string | null,
    extraMeta: Record<string, unknown> = {},
    skipConversationStatus = false
  ) {
    const fresh = await prisma.message.findUnique({
      where: { id: ctx.message.id },
      select: { metadata: true },
    });
    const meta: Record<string, unknown> = { ...asObj(fresh?.metadata), ...extraMeta };
    if (cls.legacyClass) meta.legacyClass = cls.legacyClass;
    if (cls.originalSlug) meta.originalClass = cls.originalSlug;
    if (cls.timeframe) meta.timeframe = cls.timeframe;
    if (cls.referralEmail) meta.referralEmail = cls.referralEmail;
    if (cls.referralName) meta.referralName = cls.referralName;

    await prisma.message.update({
      where: { id: ctx.message.id },
      data: {
        aiClassification: cls.enumValue,
        aiConfidence: cls.confidence,
        aiReasoningSummary: cls.reasoning || null,
        aiSummary: cls.reasoning || undefined,
        aiModel: cls.model,
        aiCost: cls.cost,
        holdReason: hold,
        metadata: asJson(meta),
      },
    });

    await prisma.inboxConversation.update({
      where: { id: ctx.conversation.id },
      data: {
        latestClass: cls.enumValue,
        latestConfidence: cls.confidence,
        holdReason: hold,
        ...(skipConversationStatus
          ? {}
          : cls.slug === "out_of_office"
            ? {}
            : {
                status: InboxConversationStatus.NEEDS_ACTION,
                nextActionAt: ctx.now,
              }),
        lastMessageAt: ctx.message.receivedAt ?? ctx.now,
      },
    });
  }

  // ───────────────────────────── timeline / opportunity ─────────────────────────────

  private async recordReplyReceived(ctx: Ctx) {
    if (!ctx.company) return;
    await timelineService.record({
      organizationId: ctx.organizationId,
      companyId: ctx.company.id,
      contactId: ctx.contact?.id ?? null,
      opportunityId: ctx.opportunity?.id ?? null,
      type: CompanyTimelineEventType.REPLY_RECEIVED,
      title: `Reply received${ctx.contact ? ` from ${ctx.contact.fullName}` : ""}`,
      details: { messageId: ctx.message.id, conversationId: ctx.conversation.id },
      actor: TimelineActor.SYSTEM,
      dedupeKey: `reply_received:${ctx.message.id}`,
    });
  }

  private async recordClassified(ctx: Ctx, cls: Classification, hold: string | null) {
    if (!ctx.company) return;
    await timelineService.record({
      organizationId: ctx.organizationId,
      companyId: ctx.company.id,
      contactId: ctx.contact?.id ?? null,
      opportunityId: ctx.opportunity?.id ?? null,
      type: CompanyTimelineEventType.REPLY_CLASSIFIED,
      title: `Classified: ${cls.slug}${hold ? ` (held: ${hold})` : ""}`,
      details: {
        class: cls.slug,
        confidence: cls.confidence,
        holdReason: hold,
        reasoning: cls.reasoning,
        legacyClass: cls.legacyClass,
        originalClass: cls.originalSlug,
      },
      actor: TimelineActor.AI,
      dedupeKey: `reply_classified:${ctx.message.id}`,
    });
  }

  /** Move opportunity forward only (never downgrade). */
  private async bumpOpportunity(
    ctx: Ctx,
    target: OpportunityStage,
    eventType: OpportunityEventType,
    title: string
  ) {
    if (!ctx.opportunity) return;
    const opp = await prisma.opportunity.findFirst({
      where: { id: ctx.opportunity.id, organizationId: ctx.organizationId },
      select: { id: true, stage: true, status: true },
    });
    if (!opp || opp.status !== OpportunityStatus.OPEN) return;
    if (STAGE_RANK[opp.stage] >= STAGE_RANK[target]) return;

    await prisma.opportunity.update({
      where: { id: opp.id },
      data: { stage: target, nextActionAt: ctx.now },
    });
    await prisma.opportunityEvent.create({
      data: {
        organizationId: ctx.organizationId,
        opportunityId: opp.id,
        type: eventType,
        title,
        metadata: asJson({
          from: opp.stage,
          to: target,
          messageId: ctx.message.id,
          source: "ai_reply",
        }),
      },
    });
  }

  /** g. INTERESTED → POSITIVE_REPLY; NOT_INTERESTED → LOST (with reason). */
  private async applyOpportunityForClass(ctx: Ctx, slug: Phase5Class, reasoning: string) {
    if (slug === "interested") {
      await this.bumpOpportunity(
        ctx,
        OpportunityStage.POSITIVE_REPLY,
        OpportunityEventType.POSITIVE_REPLY,
        "Positive reply (AI classified as interested)"
      );
      return;
    }
    if (slug === "not_interested" && ctx.opportunity) {
      const opp = await prisma.opportunity.findFirst({
        where: { id: ctx.opportunity.id, organizationId: ctx.organizationId },
        select: { id: true, stage: true, status: true },
      });
      if (!opp || opp.status !== OpportunityStatus.OPEN || opp.stage === OpportunityStage.WON) {
        return;
      }
      const reason = `Not interested — ${reasoning || "prospect declined"}`.slice(0, 500);
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: { stage: OpportunityStage.LOST, status: OpportunityStatus.LOST, nextActionAt: null },
      });
      await prisma.opportunityEvent.create({
        data: {
          organizationId: ctx.organizationId,
          opportunityId: opp.id,
          type: OpportunityEventType.LOST,
          title: "Marked lost (not interested)",
          description: reason,
          metadata: asJson({ from: opp.stage, messageId: ctx.message.id, source: "ai_reply" }),
        },
      });
      if (ctx.company) {
        await timelineService.record({
          organizationId: ctx.organizationId,
          companyId: ctx.company.id,
          contactId: ctx.contact?.id ?? null,
          opportunityId: opp.id,
          type: CompanyTimelineEventType.LOST,
          title: "Lost — prospect not interested",
          details: { reason },
          actor: TimelineActor.AI,
          dedupeKey: `lost_not_interested:${ctx.message.id}`,
        });
      }
    }
  }

  // ───────────────────────────── referral / not_now ─────────────────────────────

  /** n. Create referred contact. Does NOT email them — left for pitch review. */
  private async createReferralContact(ctx: Ctx, cls: Classification): Promise<Contact | null> {
    const email = cls.referralEmail;
    const companyId = ctx.company?.id ?? ctx.contact?.companyId ?? null;
    if (!email || !companyId) return null;

    const normalizedEmail = email.trim().toLowerCase();
    let contact = await prisma.contact.findFirst({
      where: { organizationId: ctx.organizationId, normalizedEmail },
    });

    if (!contact) {
      const name = (cls.referralName || "").trim();
      const parts = name.split(/\s+/).filter(Boolean);
      const local = normalizedEmail.split("@")[0].replace(/[._-]+/g, " ").trim();
      const firstName = parts[0] || local.split(" ")[0] || "Referral";
      const lastName = parts.slice(1).join(" ");
      try {
        contact = await prisma.contact.create({
          data: {
            organizationId: ctx.organizationId,
            companyId,
            firstName,
            lastName,
            fullName: name || `${firstName} ${lastName}`.trim(),
            email,
            normalizedEmail,
            source: "referral",
            metadata: asJson({
              referredBy: {
                contactId: ctx.contact?.id ?? null,
                email: ctx.message.fromEmail ?? null,
                name: ctx.contact?.fullName ?? null,
                messageId: ctx.message.id,
                conversationId: ctx.conversation.id,
              },
              referralStatus: "pending_pitch_review",
              doNotAutoEmail: true,
            }),
          },
        });
      } catch (err) {
        // Unique race on [organizationId, normalizedEmail]
        contact = await prisma.contact.findFirst({
          where: { organizationId: ctx.organizationId, normalizedEmail },
        });
        if (!contact) {
          console.warn("[ai-reply] referral contact create failed", errMsg(err));
          return null;
        }
      }

      if (ctx.company) {
        await timelineService.record({
          organizationId: ctx.organizationId,
          companyId: ctx.company.id,
          contactId: contact.id,
          opportunityId: ctx.opportunity?.id ?? null,
          type: CompanyTimelineEventType.REFERRAL_CREATED,
          title: `Referral contact created: ${contact.fullName}`,
          details: { referredByMessageId: ctx.message.id, email },
          actor: TimelineActor.AI,
          dedupeKey: `referral:${ctx.message.id}`,
        });
      }

      await notificationService.notifyReferral({
        organizationId: ctx.organizationId,
        conversationId: ctx.conversation.id,
        opportunityId: ctx.opportunity?.id ?? null,
        contactName: ctx.contact?.fullName ?? null,
        companyName: ctx.company?.name ?? null,
        referralName: cls.referralName,
        referralEmail: email,
        referralContactId: contact.id,
      });
    }
    return contact;
  }

  /** o. not_now → follow-up task (timeframe or default +60 days). */
  private async createNotNowTask(ctx: Ctx, cls: Classification) {
    const marker = `[ai-reply:${ctx.message.id}]`;
    const exists = await prisma.task.findFirst({
      where: { organizationId: ctx.organizationId, description: { contains: marker } },
      select: { id: true },
    });
    if (exists) return;

    const due = parseTimeframeToDate(cls.timeframe, ctx.now);
    const owner = await notificationService.resolveOwner(
      ctx.organizationId,
      ctx.opportunity?.id ?? null
    );
    const who = ctx.contact?.fullName || ctx.company?.name || ctx.message.fromEmail || "prospect";

    await prisma.task.create({
      data: {
        organizationId: ctx.organizationId,
        title: `Follow up with ${who} (not now)`.slice(0, 200),
        description: [
          `Prospect said "not now"${cls.timeframe ? ` — timeframe: ${cls.timeframe}` : ""}.`,
          cls.reasoning ? `AI summary: ${cls.reasoning}` : "",
          marker,
        ]
          .filter(Boolean)
          .join("\n"),
        type: TaskType.FOLLOW_UP,
        priority: TaskPriority.MEDIUM,
        dueDate: due,
        opportunityId: ctx.opportunity?.id ?? null,
        companyId: ctx.company?.id ?? ctx.contact?.companyId ?? null,
        contactId: ctx.contact?.id ?? null,
        assignedToId: owner?.userId ?? null,
      },
    });

    await prisma.inboxConversation.update({
      where: { id: ctx.conversation.id },
      data: { nextActionAt: due },
    });

    if (ctx.company) {
      await timelineService.record({
        organizationId: ctx.organizationId,
        companyId: ctx.company.id,
        contactId: ctx.contact?.id ?? null,
        opportunityId: ctx.opportunity?.id ?? null,
        type: CompanyTimelineEventType.FOLLOWUP_SCHEDULED,
        title: `Follow-up scheduled for ${due.toISOString().slice(0, 10)} (not now)`,
        details: { timeframe: cls.timeframe, due: due.toISOString() },
        actor: TimelineActor.AI,
        dedupeKey: `not_now_task:${ctx.message.id}`,
      });
    }
  }

  // ───────────────────────────── drafting ─────────────────────────────

  private wantsDraft(cls: Classification, cfg: AiReplyConfig, hasReferral: boolean): boolean {
    switch (cls.slug) {
      case "interested":
      case "question":
      case "not_now":
        return true;
      case "wrong_person":
        return hasReferral; // brief thank-you to the sender only
      case "not_interested":
        return cfg.notInterestedSendClose;
      default:
        return false;
    }
  }

  private async buildDraftContext(ctx: Ctx): Promise<string> {
    const orgId = ctx.organizationId;
    const [brain, caseStudies, pitch, audit, thread] = await Promise.all([
      businessBrainService.getSafeContext(orgId).catch(() => null),
      prisma.serviceCaseStudy
        .findMany({
          where: { organizationId: orgId },
          orderBy: { updatedAt: "desc" },
          take: 5,
        })
        .catch(() => []),
      ctx.contact
        ? prisma.pitch.findFirst({
            where: {
              organizationId: orgId,
              contactId: ctx.contact.id,
              status: { in: ["APPROVED", "SUPERSEDED"] },
            },
            orderBy: { updatedAt: "desc" },
          })
        : Promise.resolve(null),
      ctx.company
        ? prisma.websiteAudit.findFirst({
            where: { organizationId: orgId, companyId: ctx.company.id, status: "DONE" },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve(null),
      prisma.message.findMany({
        where: { conversationId: ctx.conversation.id, organizationId: orgId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          direction: true,
          subject: true,
          body: true,
          createdAt: true,
        },
      }),
    ]);

    const sections: string[] = [];

    if (brain?.profile) {
      const p = brain.profile;
      sections.push(
        [
          "## Our company (trusted)",
          `Name: ${p.companyName}`,
          p.description ? `About: ${p.description}` : "",
          p.positioning ? `Positioning: ${p.positioning}` : "",
          p.valueProposition ? `Value proposition: ${p.valueProposition}` : "",
          p.competitiveAdvantages.length
            ? `Advantages: ${p.competitiveAdvantages.join("; ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n")
      );
    }

    if (brain?.services.length) {
      // Budgets intentionally omitted — the agent must never quote prices.
      sections.push(
        "## Services (trusted)\n" +
          brain.services
            .slice(0, 12)
            .map(
              (s) =>
                `- ${s.name}: ${s.description}` +
                (s.problemsSolved.length ? ` | Solves: ${s.problemsSolved.slice(0, 5).join(", ")}` : "") +
                (s.technologies.length ? ` | Tech: ${s.technologies.slice(0, 8).join(", ")}` : "")
            )
            .join("\n")
      );
    }

    if (brain?.documents.length) {
      sections.push(
        "## Business Brain documents (trusted)\n" +
          brain.documents
            .slice(0, 10)
            .map((d) => `- [${d.type}] ${d.title}: ${d.summary}`)
            .join("\n")
      );
    }

    if (caseStudies.length) {
      sections.push(
        "## Case studies (trusted)\n" +
          caseStudies
            .map(
              (c) =>
                `- ${c.title}${c.customerIndustry ? ` (${c.customerIndustry})` : ""}: ` +
                [c.problem, c.solution, c.outcome].filter(Boolean).join(" → ").slice(0, 400)
            )
            .join("\n")
      );
    }

    if (pitch) {
      sections.push(
        [
          "## Approved pitch we sent (trusted)",
          pitch.shortPitch ? `Pitch: ${pitch.shortPitch}` : "",
          pitch.topIssue ? `Top issue noted: ${pitch.topIssue}` : "",
          pitch.recommendedService ? `Recommended service: ${pitch.recommendedService}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      );
    }

    if (audit) {
      const findings = JSON.stringify(audit.findings ?? {}).slice(0, 1500);
      sections.push(
        "## Website audit summary\n" +
          wrapUntrustedContent(
            "audit_summary",
            `Mobile PageSpeed: ${audit.pageSpeedMobile ?? "n/a"}; Desktop: ${audit.pageSpeedDesktop ?? "n/a"}\nFindings: ${findings}`,
            2000
          )
      );
    }

    const history = thread
      .filter((m) => m.id !== ctx.message.id)
      .reverse()
      .map(
        (m) =>
          `[${m.direction} ${m.createdAt.toISOString().slice(0, 10)}] ${m.subject ?? ""}\n${stripQuotedReply(m.body ?? "").slice(0, 1200)}`
      )
      .join("\n---\n");
    if (history) {
      sections.push(
        "## Thread history (oldest → newest, excluding latest)\n" +
          sanitizeExternalForAI("thread_history", history)
      );
    }

    const text = sections.join("\n\n");
    return text.length > 14_000 ? `${text.slice(0, 14_000)}\n…` : text;
  }

  /** Quality-tier draft. Returns hold reason when output is unsafe / unusable. */
  private async generateDraft(
    ctx: Ctx,
    slug: Phase5Class,
    cls: Classification
  ): Promise<{ draft: DraftText | null; holdReason: string | null }> {
    const branding = await emailBrandingService.get(ctx.organizationId);
    const bookingUrl = branding.bookingUrl.trim();
    const websiteUrl = branding.websiteUrl.trim();

    const context = await this.buildDraftContext(ctx);
    const extra = [
      `Class: ${slug}`,
      cls.timeframe ? `Prospect timeframe: ${cls.timeframe}` : "",
      cls.referralName || cls.referralEmail
        ? `Referral mentioned: ${cls.referralName ?? ""} ${cls.referralEmail ?? ""}`.trim()
        : "",
      "Do NOT include a signature, sign-off name, subject line, or placeholders like [Name] — a signature is appended automatically.",
      "Write in the same language as the prospect (English).",
    ]
      .filter(Boolean)
      .join("\n");

    let result: AICompletionResult;
    try {
      result = await this.callAi(ctx, {
        feature: "ai_reply_draft",
        operation: "ai_reply_draft",
        system: buildDraftSystemPrompt({
          bookingUrl,
          websiteUrl,
          classSlug: slug,
        }),
        user: [
          context,
          "## Latest prospect email",
          wrapInboundEmailForAI(ctx.subject, ctx.cleanBody),
          "## Instructions",
          extra,
        ]
          .filter(Boolean)
          .join("\n\n"),
        temperature: 0.4,
        maxTokens: 700,
        model: ctx.cfg.draftModel || undefined,
      });
    } catch (err) {
      return { draft: null, holdReason: `draft_failed: ${errMsg(err)}`.slice(0, 200) };
    }

    let raw: RawDraft;
    try {
      raw = parseAIJson<RawDraft>(result.content);
    } catch {
      return {
        draft: null,
        holdReason: "draft_invalid_json",
      };
    }

    const replyText = typeof raw.reply_text === "string" ? raw.reply_text.trim() : "";
    const aiHold = str(raw.hold_reason, 200);
    const confidence = clamp01(raw.confidence, cls.confidence);
    const draft: DraftText = {
      replyText,
      offersBooking: raw.offers_booking === true,
      holdReason: aiHold,
      confidence,
      model: result.model ?? null,
      cost: extractCost(result),
    };

    if (aiHold) return { draft, holdReason: aiHold };

    const v = validateAiReplyText({ replyText, bookingUrl, websiteUrl });
    if (!v.ok) return { draft, holdReason: `validation:${v.reason}` };
    if (PLACEHOLDER_RE.test(replyText)) {
      return { draft, holdReason: "validation:placeholder_in_reply" };
    }
    if (confidence < ctx.cfg.confidenceThreshold) {
      return { draft, holdReason: "low_draft_confidence" };
    }
    return { draft, holdReason: null };
  }

  // ───────────────────────────── persist / deliver ─────────────────────────────

  private isAutoEligible(ctx: Ctx, slug: Phase5Class, outboundShadow: boolean) {
    const { cfg } = ctx;
    if (cfg.mode !== "AUTO_SEND") return { ok: false as const, reason: "mode_draft_only" };
    if (!AUTO_SEND_CLASSES.has(slug)) return { ok: false as const, reason: "class_not_auto_eligible" };
    const toggle = cfg.autoSendByClass[slug as "interested" | "question" | "not_now"];
    if (!toggle) return { ok: false as const, reason: "class_auto_send_disabled" };
    if (cfg.killSwitch) return { ok: false as const, reason: "kill_switch" };
    if (cfg.shadow) return { ok: false as const, reason: "ai_shadow" };
    if (outboundShadow) return { ok: false as const, reason: "outbound_shadow" };
    return { ok: true as const };
  }

  private async persistDraft(
    ctx: Ctx,
    args: {
      existing: AiReplyDraft | null;
      cls: Classification;
      replyText: string;
      offersBooking: boolean;
      holdReason: string | null;
      draftModel: string | null;
      draftCost: number;
      /** false for regenerate / reclassify (human is in the loop) */
      allowAutoSend: boolean;
      referralContact?: Contact | null;
    }
  ): Promise<{ draft: AiReplyDraft; outcome: HandleInboundResult["outcome"] }> {
    const { cls } = args;
    const slug = cls.slug;

    // Newer inbound arrived while we were calling the AI → don't act on stale context.
    if (args.allowAutoSend) {
      const newer = await prisma.message.count({
        where: {
          conversationId: ctx.conversation.id,
          direction: MessageDirection.INBOUND,
          id: { not: ctx.message.id },
          createdAt: { gt: ctx.message.createdAt },
        },
      });
      if (newer > 0) {
        const cancelled = await this.upsertDraftRow(ctx, args, {
          status: AiReplyStatus.CANCELLED,
          holdReason: "superseded_by_newer_inbound",
          outboxId: null,
          scheduledFor: null,
        });
        return { draft: cancelled, outcome: "superseded" };
      }
    }

    const outboundShadow = (await outboundConfigService.getConfig(ctx.organizationId)).shadowMode;
    const hasText = args.replyText.trim().length > 0;

    let holdReason = args.holdReason;
    const metaExtra: Record<string, unknown> = {};
    let wantQueue = false;

    if (!holdReason && !hasText) {
      holdReason = "empty_reply";
    } else if (!holdReason && args.allowAutoSend) {
      const elig = this.isAutoEligible(ctx, slug, outboundShadow);
      if (elig.ok) wantQueue = true;
      else metaExtra.notAutoSentReason = elig.reason;
    }

    let draft = await this.upsertDraftRow(ctx, args, {
      status: holdReason ? AiReplyStatus.HELD : AiReplyStatus.DRAFT,
      holdReason,
      outboxId: args.existing?.outboxId ?? null,
      scheduledFor: null,
      metaExtra,
    });

    let outcome: HandleInboundResult["outcome"] = holdReason ? "held" : "drafted";

    if (wantQueue) {
      const queued = await this.queueOutbox(ctx, draft, draft.replyText, { immediate: false });
      if (queued.ok) {
        draft = await prisma.aiReplyDraft.update({
          where: { id: draft.id },
          data: {
            status: AiReplyStatus.QUEUED,
            outboxId: queued.outbox.id,
            scheduledFor: queued.outbox.scheduledFor,
          },
        });
        outcome = "queued";
      } else {
        draft = await prisma.aiReplyDraft.update({
          where: { id: draft.id },
          data: {
            status: AiReplyStatus.HELD,
            holdReason: queued.reason,
            metadata: asJson({ ...asObj(draft.metadata), queueFailed: queued.reason }),
          },
        });
        outcome = "held";
        holdReason = queued.reason;
      }
    }

    // Surface hold on message/conversation (cleared when a regenerated draft is no longer held).
    if (holdReason || !args.allowAutoSend) {
      await prisma.message.update({
        where: { id: ctx.message.id },
        data: { holdReason: holdReason ?? null },
      });
      await prisma.inboxConversation.update({
        where: { id: ctx.conversation.id },
        data: { holdReason: holdReason ?? null },
      });
    }

    // Timeline + notifications
    if (ctx.company) {
      if (draft.status === AiReplyStatus.HELD) {
        await timelineService.record({
          organizationId: ctx.organizationId,
          companyId: ctx.company.id,
          contactId: ctx.contact?.id ?? null,
          opportunityId: ctx.opportunity?.id ?? null,
          type: CompanyTimelineEventType.HELD_FOR_HUMAN,
          title: `AI reply held: ${holdReason ?? "needs review"}`,
          details: { draftId: draft.id, holdReason, class: slug },
          actor: TimelineActor.AI,
          dedupeKey: `ai_held:${draft.id}:${holdReason ?? ""}`,
        });
      } else if (hasText) {
        await timelineService.record({
          organizationId: ctx.organizationId,
          companyId: ctx.company.id,
          contactId: ctx.contact?.id ?? null,
          opportunityId: ctx.opportunity?.id ?? null,
          type: CompanyTimelineEventType.AI_DRAFTED,
          title: `AI drafted a ${slug} reply${draft.status === AiReplyStatus.QUEUED ? " (queued to send)" : ""}`,
          details: { draftId: draft.id, class: slug, scheduledFor: draft.scheduledFor },
          actor: TimelineActor.AI,
          dedupeKey: `ai_drafted:${draft.id}`,
        });
      }
    }

    if (args.allowAutoSend) {
      await this.notifyForDraft(ctx, draft, cls, holdReason);
    }

    return { draft, outcome };
  }

  private async notifyForDraft(
    ctx: Ctx,
    draft: AiReplyDraft,
    cls: Classification,
    holdReason: string | null
  ) {
    const base = {
      organizationId: ctx.organizationId,
      conversationId: ctx.conversation.id,
      opportunityId: ctx.opportunity?.id ?? null,
      contactName: ctx.contact?.fullName ?? null,
      companyName: ctx.company?.name ?? null,
    };
    try {
      if (draft.status === AiReplyStatus.CANCELLED) return;
      if (draft.status === AiReplyStatus.HELD) {
        await notificationService.notifyHeld({
          ...base,
          holdReason: holdReason ?? draft.holdReason ?? "needs review",
          classSlug: cls.slug,
        });
        return;
      }
      if (cls.slug === "interested") {
        await notificationService.notifyInterested({
          ...base,
          summary: cls.reasoning,
          confidence: cls.confidence,
        });
        return;
      }
      if (draft.status === AiReplyStatus.DRAFT) {
        await notificationService.notifyHeld({
          ...base,
          holdReason: "Draft ready for your review (auto-send is not enabled for this reply)",
          classSlug: cls.slug,
        });
      }
    } catch (err) {
      console.warn("[ai-reply] notify failed", errMsg(err));
    }
  }

  /** Create (or update on regenerate) the AiReplyDraft row — idempotent on inboundMessageId. */
  private async upsertDraftRow(
    ctx: Ctx,
    args: {
      existing: AiReplyDraft | null;
      cls: Classification;
      replyText: string;
      offersBooking: boolean;
      draftModel: string | null;
      draftCost: number;
    },
    state: {
      status: AiReplyStatus;
      holdReason: string | null;
      outboxId: string | null;
      scheduledFor: Date | null;
      metaExtra?: Record<string, unknown>;
    }
  ): Promise<AiReplyDraft> {
    const { cls } = args;
    const meta = {
      ...asObj(args.existing?.metadata),
      ...(state.metaExtra ?? {}),
      ...(cls.legacyClass ? { legacyClass: cls.legacyClass } : {}),
      ...(cls.originalSlug ? { originalClass: cls.originalSlug } : {}),
      ...(cls.timeframe ? { timeframe: cls.timeframe } : {}),
      ...(cls.referralEmail ? { referralEmail: cls.referralEmail } : {}),
      ...(cls.referralName ? { referralName: cls.referralName } : {}),
      reasoning: cls.reasoning,
    };

    const data = {
      status: state.status,
      class: cls.enumValue,
      confidence: cls.confidence,
      holdReason: state.holdReason,
      replyText: args.replyText,
      offersBooking: args.offersBooking,
      classifyModel: cls.model,
      draftModel: args.draftModel,
      classifyCost: cls.cost,
      draftCost: args.draftCost,
      scheduledFor: state.scheduledFor,
      outboxId: state.outboxId,
      metadata: asJson(meta),
    };

    if (args.existing) {
      return prisma.aiReplyDraft.update({ where: { id: args.existing.id }, data });
    }

    try {
      return await prisma.aiReplyDraft.create({
        data: {
          organizationId: ctx.organizationId,
          conversationId: ctx.conversation.id,
          inboundMessageId: ctx.message.id,
          ...data,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const raced = await prisma.aiReplyDraft.findUnique({
          where: { inboundMessageId: ctx.message.id },
        });
        if (raced) return raced;
      }
      throw err;
    }
  }

  private async resolveAccount(ctx: Ctx): Promise<EmailAccount | null> {
    const id = ctx.conversation.emailAccountId ?? ctx.message.emailAccountId;
    if (!id) return null;
    const acc = await prisma.emailAccount.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    return acc && acc.status === "ACTIVE" ? acc : null;
  }

  private async prospectTimezone(ctx: Ctx): Promise<string> {
    if (ctx.company?.timezone) return ctx.company.timezone;
    const org = await prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { timezone: true },
    });
    return org?.timezone || "UTC";
  }

  private async signedBody(organizationId: string, accountId: string, text: string) {
    const mailbox = await prisma.outboundMailbox.findFirst({
      where: { organizationId, emailAccountId: accountId },
      select: { id: true },
    });
    const sender = await emailBrandingService.resolveForSend(organizationId, mailbox?.id ?? null);
    const signature = [
      "Best,",
      sender.senderName,
      [sender.senderTitle, sender.companyLegalName].filter(Boolean).join(" · "),
      sender.websiteUrl,
    ]
      .filter(Boolean)
      .join("\n");
    return `${text.trim()}\n\n${signature}`;
  }

  /**
   * Outbox requires contactId. Inbound threads sometimes have no linked Contact
   * (e.g. reply matched by thread only). Find-or-create from From: address.
   */
  private async ensureContactForReply(ctx: Ctx): Promise<Contact | null> {
    if (ctx.contact) return ctx.contact;

    const toEmail = (ctx.message.fromEmail || "").trim().toLowerCase();
    if (!toEmail || !EMAIL_RE.test(toEmail)) return null;

    let contact = await prisma.contact.findFirst({
      where: contactEmailMatchWhere(ctx.organizationId, toEmail),
    });

    if (!contact) {
      const domain = toEmail.split("@")[1]?.toLowerCase() || "unknown";
      let companyId = ctx.conversation.companyId ?? ctx.company?.id ?? null;
      if (!companyId) {
        const company = await companyService.findOrCreate(
          ctx.organizationId,
          domain,
          { domain, website: `https://${domain}` }
        );
        companyId = company.id;
      }

      const local = toEmail.split("@")[0] || "Prospect";
      const parts = local.replace(/[._+-]+/g, " ").trim().split(/\s+/);
      const firstName = (parts[0] || "Prospect").slice(0, 80);
      const lastName = (parts.slice(1).join(" ") || "Reply").slice(0, 80);
      const normalized = normalizeEmail(toEmail);

      try {
        contact = await prisma.contact.create({
          data: {
            id: randomUUID(),
            organizationId: ctx.organizationId,
            companyId,
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`.trim(),
            email: toEmail,
            normalizedEmail: normalized,
            source: "inbound_reply",
            status: ContactStatus.ACTIVE,
          },
        });
      } catch {
        // Race / unique: another request created the same email
        contact = await prisma.contact.findFirst({
          where: contactEmailMatchWhere(ctx.organizationId, toEmail),
        });
      }
    }

    if (!contact) return null;

    // Persist link so future sends / UI don't hit no_contact again
    if (
      !ctx.conversation.contactId ||
      (!ctx.conversation.companyId && contact.companyId)
    ) {
      await prisma.inboxConversation.update({
        where: { id: ctx.conversation.id },
        data: {
          contactId: ctx.conversation.contactId ?? contact.id,
          companyId: ctx.conversation.companyId ?? contact.companyId,
        },
      });
      ctx.conversation = {
        ...ctx.conversation,
        contactId: ctx.conversation.contactId ?? contact.id,
        companyId: ctx.conversation.companyId ?? contact.companyId,
      };
    }

    ctx.contact = contact;
    return contact;
  }

  /** l. Queue (or re-queue) the single AI_REPLY outbox row for an inbound message. */
  private async queueOutbox(
    ctx: Ctx,
    draft: AiReplyDraft,
    text: string,
    opts: { immediate: boolean }
  ): Promise<{ ok: true; outbox: EmailOutbox } | { ok: false; reason: string }> {
    const contact = await this.ensureContactForReply(ctx);
    if (!contact) return { ok: false, reason: "no_contact" };

    const toEmail = (ctx.message.fromEmail || contact.email || "").trim().toLowerCase();
    if (!toEmail || !EMAIL_RE.test(toEmail)) return { ok: false, reason: "no_recipient" };

    const suppressed = await emailSafetyService.isSuppressed(ctx.organizationId, toEmail);
    if (suppressed) return { ok: false, reason: "suppressed" };

    const account = await this.resolveAccount(ctx);
    if (!account) return { ok: false, reason: "no_active_mailbox" };

    const idempotencyKey = `ai-reply:${ctx.message.id}`;
    const existing = await prisma.emailOutbox.findUnique({ where: { idempotencyKey } });
    if (existing && (existing.status === EmailOutboxStatus.SENT || existing.status === EmailOutboxStatus.SENDING)) {
      return { ok: false, reason: "already_sent_or_sending" };
    }

    const body = await this.signedBody(ctx.organizationId, account.id, text);
    const inboundRfc =
      toRfcMessageId(ctx.headers.messageId) ?? toRfcMessageId(ctx.message.providerMessageId);
    const refs = [ctx.headers.references?.trim(), inboundRfc].filter(Boolean).join(" ") || null;
    const tz = await this.prospectTimezone(ctx);
    const scheduledFor = opts.immediate
      ? new Date()
      : nextAiReplySendAt(new Date(), tz);

    const common = {
      organizationId: ctx.organizationId,
      purpose: EmailOutboxPurpose.AI_REPLY,
      enrollmentId: null,
      stepOrder: null,
      inboundMessageId: ctx.message.id,
      contactId: contact.id,
      companyId: ctx.company?.id ?? contact.companyId ?? null,
      opportunityId: ctx.opportunity?.id ?? null,
      emailAccountId: account.id,
      outboundMailboxId: null,
      toEmail,
      subject: normalizeSubject(ctx.message.subject ?? ctx.conversation.subject),
      bodyText: body,
      bodyHtml: null,
      inReplyTo: inboundRfc,
      referencesHeader: refs,
      scheduledFor,
      heldReason: null,
      lastError: null,
      shadowMode: false,
      metadata: asJson({ aiReply: true, draftId: draft.id }),
    };

    const outbox = existing
      ? await prisma.emailOutbox.update({
          where: { id: existing.id },
          data: { ...common, status: EmailOutboxStatus.QUEUED, attemptCount: 0 },
        })
      : await prisma.emailOutbox.create({
          data: { ...common, idempotencyKey, status: EmailOutboxStatus.QUEUED },
        });

    return { ok: true, outbox };
  }

  // ───────────────────────────── public: draft actions ─────────────────────────────

  private async getDraft(draftId: string, organizationId: string): Promise<AiReplyDraft> {
    const draft = await prisma.aiReplyDraft.findFirst({
      where: { id: draftId, organizationId },
    });
    if (!draft) throw new NotFoundError("AI reply draft not found");
    return draft;
  }

  private async cancelDraftOutbox(draft: AiReplyDraft, reason: string) {
    await prisma.emailOutbox.updateMany({
      where: {
        inboundMessageId: draft.inboundMessageId,
        organizationId: draft.organizationId,
        purpose: EmailOutboxPurpose.AI_REPLY,
        status: { in: [EmailOutboxStatus.QUEUED, EmailOutboxStatus.HELD] },
      },
      data: { status: EmailOutboxStatus.CANCELLED, lastError: reason },
    });
  }

  /**
   * Re-generate text for the LATEST inbound only. Never auto-sends (human in the loop).
   */
  async regenerate(draftId: string, organizationId: string, userId?: string) {
    const draft = await this.getDraft(draftId, organizationId);
    if (draft.status === AiReplyStatus.SENT) {
      throw new ValidationError("Draft was already sent");
    }

    const latestInbound = await prisma.message.findFirst({
      where: {
        conversationId: draft.conversationId,
        organizationId,
        direction: MessageDirection.INBOUND,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (latestInbound && latestInbound.id !== draft.inboundMessageId) {
      throw new ValidationError(
        "A newer inbound message exists — regenerate the draft for the latest message",
        { latestInboundMessageId: latestInbound.id }
      );
    }

    await this.cancelDraftOutbox(draft, "regenerate");
    const ctx = await this.ctxForDraft(draft, userId);

    const enumClass = draft.humanOverrideClass ?? draft.class;
    const slug = enumToPhase5Slug(enumClass);
    const cls = this.classificationFromDraft(draft, slug, enumClass);

    const hold0 = detectHoldTriggers(`${ctx.subject}\n${ctx.cleanBody}`, ctx.cfg.holdTriggers, {
      nonEnglishHold: ctx.cfg.nonEnglishHold,
    });

    const gen = await this.generateDraft(ctx, slug, cls);
    const holdReason = hold0 ?? gen.holdReason;

    const { draft: updated } = await this.persistDraft(ctx, {
      existing: draft,
      cls,
      replyText: gen.draft?.replyText ?? "",
      offersBooking: gen.draft?.offersBooking ?? false,
      holdReason,
      draftModel: gen.draft?.model ?? null,
      draftCost: Number(draft.draftCost ?? 0) + (gen.draft?.cost ?? 0),
      allowAutoSend: false,
    });

    return prisma.aiReplyDraft.update({
      where: { id: updated.id },
      data: {
        dismissedAt: null,
        metadata: asJson({
          ...asObj(updated.metadata),
          regeneratedAt: new Date().toISOString(),
          regeneratedBy: userId ?? null,
        }),
      },
    });
  }

  private classificationFromDraft(
    draft: AiReplyDraft,
    slug: Phase5Class,
    enumClass: MessageAiClassification
  ): Classification {
    const meta = asObj(draft.metadata);
    return {
      slug,
      enumValue: enumClass,
      confidence: Number(draft.confidence),
      holdReason: null,
      reasoning: typeof meta.reasoning === "string" ? meta.reasoning : "",
      timeframe: typeof meta.timeframe === "string" ? meta.timeframe : null,
      referralName: typeof meta.referralName === "string" ? meta.referralName : null,
      referralEmail: typeof meta.referralEmail === "string" ? meta.referralEmail : null,
      oooReturnHint: null,
      model: draft.classifyModel,
      cost: Number(draft.classifyCost ?? 0),
      legacyClass: typeof meta.legacyClass === "string" ? meta.legacyClass : null,
      originalSlug: null,
      failed: false,
    };
  }

  /**
   * Send now (human action). Queues through the outbox for idempotency and delivers
   * immediately. Bypasses AI shadow/kill-switch (explicit human intent) but still
   * respects suppression and requires an active mailbox.
   */
  async sendDraft(
    draftId: string,
    organizationId: string,
    userId?: string,
    opts: { editText?: string } = {}
  ) {
    const draft = await this.getDraft(draftId, organizationId);
    if (draft.status === AiReplyStatus.SENT) {
      throw new ValidationError("Draft was already sent");
    }
    if (draft.status === AiReplyStatus.DISMISSED) {
      throw new ValidationError("Draft was dismissed");
    }

    const edited = typeof opts.editText === "string";
    const text = (edited ? opts.editText! : draft.replyText).trim();
    if (!text) throw new ValidationError("Reply text is empty — edit the draft before sending");
    if (text.length > 6000) throw new ValidationError("Reply is too long");
    if (PLACEHOLDER_RE.test(text)) {
      throw new ValidationError("Reply still contains a [placeholder] — fill it in before sending");
    }

    const ctx = await this.ctxForDraft(draft, userId);

    const queued = await this.queueOutbox(ctx, draft, text, { immediate: true });
    if (!queued.ok) {
      throw new ValidationError(`Cannot send reply: ${queued.reason}`);
    }

    await prisma.aiReplyDraft.update({
      where: { id: draft.id },
      data: {
        replyText: text,
        status: AiReplyStatus.QUEUED,
        outboxId: queued.outbox.id,
        scheduledFor: new Date(),
        metadata: asJson({
          ...asObj(draft.metadata),
          manualSend: { by: userId ?? null, edited, at: new Date().toISOString() },
        }),
      },
    });

    const res = await this.deliverOutbox(queued.outbox.id, organizationId, {
      manual: true,
      userId,
      edited,
    });

    const fresh = await this.getDraft(draftId, organizationId);
    if (res.status !== "sent") {
      throw new ValidationError(`Send failed: ${res.reason ?? res.status}`, {
        draftStatus: fresh.status,
      });
    }
    return fresh;
  }

  async dismiss(draftId: string, organizationId: string, userId?: string) {
    const draft = await this.getDraft(draftId, organizationId);
    if (draft.status === AiReplyStatus.SENT) {
      throw new ValidationError("Cannot dismiss a sent reply");
    }
    await this.cancelDraftOutbox(draft, "dismissed");
    const updated = await prisma.aiReplyDraft.update({
      where: { id: draft.id },
      data: {
        status: AiReplyStatus.DISMISSED,
        dismissedAt: new Date(),
        metadata: asJson({
          ...asObj(draft.metadata),
          dismissedBy: userId ?? null,
        }),
      },
    });
    await prisma.inboxConversation.updateMany({
      where: { id: draft.conversationId, organizationId },
      data: { holdReason: null },
    });
    return updated;
  }

  /** Human override of the classification; re-drafts (never auto-sends) when the class needs a reply. */
  async reclassify(
    draftId: string,
    organizationId: string,
    newClass: string,
    userId?: string
  ) {
    const draft = await this.getDraft(draftId, organizationId);
    if (draft.status === AiReplyStatus.SENT) {
      throw new ValidationError("Cannot reclassify after the reply was sent");
    }
    const slug = parsePhase5ClassRaw(newClass);
    const enumValue = PHASE5_CLASS_TO_ENUM[slug];

    await this.cancelDraftOutbox(draft, "reclassified");
    const ctx = await this.ctxForDraft(draft, userId);

    await prisma.message.update({
      where: { id: draft.inboundMessageId },
      data: {
        aiClassification: enumValue,
        metadata: asJson({
          ...asObj(ctx.message.metadata),
          humanReclassifiedBy: userId ?? null,
          previousClass: draft.class,
        }),
      },
    });
    await prisma.inboxConversation.update({
      where: { id: draft.conversationId },
      data: { latestClass: enumValue },
    });

    const cls: Classification = {
      ...this.classificationFromDraft(draft, slug, enumValue),
      confidence: 1,
      model: draft.classifyModel,
    };

    if (slug === "unsubscribe") {
      await this.applyUnsubscribe(ctx, "Human reclassified as unsubscribe", { source: "ai", cls });
      return prisma.aiReplyDraft.update({
        where: { id: draft.id },
        data: {
          humanOverrideClass: enumValue,
          class: enumValue,
          status: AiReplyStatus.DISMISSED,
          dismissedAt: new Date(),
        },
      });
    }

    await this.applyOpportunityForClass(ctx, slug, "Human reclassified");
    if (slug === "not_now") await this.createNotNowTask(ctx, cls);

    if (!this.wantsDraft(cls, ctx.cfg, Boolean(cls.referralEmail))) {
      return prisma.aiReplyDraft.update({
        where: { id: draft.id },
        data: {
          humanOverrideClass: enumValue,
          class: enumValue,
          status: AiReplyStatus.DISMISSED,
          dismissedAt: new Date(),
          holdReason: null,
        },
      });
    }

    await prisma.aiReplyDraft.update({
      where: { id: draft.id },
      data: { humanOverrideClass: enumValue, class: enumValue },
    });
    return this.regenerate(draft.id, organizationId, userId);
  }

  /** Append the org booking link to a draft (no AI call). */
  async insertBookingLink(draftId: string, organizationId: string) {
    const draft = await this.getDraft(draftId, organizationId);
    if (draft.status === AiReplyStatus.SENT || draft.status === AiReplyStatus.QUEUED) {
      throw new ValidationError("Draft can no longer be edited");
    }
    const branding = await emailBrandingService.get(organizationId);
    const url = branding.bookingUrl.trim();
    if (!url) {
      throw new ValidationError("No booking link configured — add one in Email branding settings");
    }
    if (draft.replyText.includes(url)) return draft;
    const line = `If it's easier, you can pick a time that suits you here: ${url}`;
    const replyText = `${draft.replyText.trim()}${draft.replyText.trim() ? "\n\n" : ""}${line}`;
    return prisma.aiReplyDraft.update({
      where: { id: draft.id },
      data: { replyText, offersBooking: true },
    });
  }

  // ───────────────────────────── kill switch / flush ─────────────────────────────

  async killSwitch(organizationId: string, on: boolean) {
    await aiReplyConfigService.setConfig(organizationId, { killSwitch: on });
    let cancelled = 0;
    if (on) {
      cancelled = await this.cancelAllQueued(organizationId, "kill_switch", AiReplyStatus.CANCELLED);
    }
    return { killSwitch: on, cancelled };
  }

  /** Cancel every QUEUED AI_REPLY outbox row (+ its draft). Never marks anything SENT. */
  private async cancelAllQueued(
    organizationId: string,
    reason: string,
    draftStatus: AiReplyStatus
  ): Promise<number> {
    const rows = await prisma.emailOutbox.findMany({
      where: {
        organizationId,
        purpose: EmailOutboxPurpose.AI_REPLY,
        status: EmailOutboxStatus.QUEUED,
      },
      select: { id: true, inboundMessageId: true },
    });
    if (rows.length === 0) return 0;

    await prisma.emailOutbox.updateMany({
      where: { id: { in: rows.map((r) => r.id) }, status: EmailOutboxStatus.QUEUED },
      data: { status: EmailOutboxStatus.CANCELLED, lastError: reason },
    });
    const inboundIds = rows.map((r) => r.inboundMessageId).filter((x): x is string => Boolean(x));
    if (inboundIds.length) {
      await prisma.aiReplyDraft.updateMany({
        where: {
          organizationId,
          inboundMessageId: { in: inboundIds },
          status: AiReplyStatus.QUEUED,
        },
        data: {
          status: draftStatus,
          holdReason: draftStatus === AiReplyStatus.CANCELLED ? reason : undefined,
        },
      });
    }
    return rows.length;
  }

  /**
   * Send due AI_REPLY outbox rows. Re-checks kill switch / AI shadow / outbound shadow each run:
   * when any is on, queued replies are cancelled (never faked as SENT).
   */
  async flushDueReplies(organizationId: string) {
    const summary = { sent: 0, cancelled: 0, held: 0, failed: 0, retried: 0, skipped: 0, blocked: null as string | null };

    const [cfg, outbound] = await Promise.all([
      aiReplyConfigService.getConfig(organizationId),
      outboundConfigService.getConfig(organizationId),
    ]);

    if (cfg.killSwitch) {
      summary.blocked = "kill_switch";
      summary.cancelled = await this.cancelAllQueued(organizationId, "kill_switch", AiReplyStatus.CANCELLED);
      return summary;
    }
    if (cfg.shadow || outbound.shadowMode) {
      summary.blocked = cfg.shadow ? "ai_shadow" : "outbound_shadow";
      // Back to DRAFT so a human can still review/send; nothing is marked SENT.
      summary.cancelled = await this.cancelAllQueued(organizationId, summary.blocked, AiReplyStatus.DRAFT);
      return summary;
    }
    if (cfg.mode !== "AUTO_SEND") {
      // Auto-send turned off after queueing — don't send behind the user's back.
      summary.blocked = "mode_not_auto_send";
      summary.cancelled = await this.cancelAllQueued(organizationId, "mode_not_auto_send", AiReplyStatus.DRAFT);
      return summary;
    }

    const due = await prisma.emailOutbox.findMany({
      where: {
        organizationId,
        purpose: EmailOutboxPurpose.AI_REPLY,
        status: EmailOutboxStatus.QUEUED,
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
      },
      orderBy: { scheduledFor: "asc" },
      take: FLUSH_BATCH,
      select: { id: true },
    });

    for (const row of due) {
      try {
        const res = await this.deliverOutbox(row.id, organizationId, { manual: false });
        if (res.status === "sent") summary.sent += 1;
        else if (res.status === "cancelled") summary.cancelled += 1;
        else if (res.status === "held") summary.held += 1;
        else if (res.status === "failed") summary.failed += 1;
        else if (res.status === "retry") summary.retried += 1;
        else summary.skipped += 1;
      } catch (err) {
        console.error("[ai-reply.flush] item failed", { outboxId: row.id, error: errMsg(err) });
        summary.failed += 1;
      }
    }
    return summary;
  }

  /**
   * Deliver a single AI_REPLY outbox row from the SAME mailbox as the conversation.
   * Uses emailProviderService.send directly — does NOT touch mailbox-pool or cold-send caps.
   */
  private async deliverOutbox(
    outboxId: string,
    organizationId: string,
    opts: { manual: boolean; userId?: string; edited?: boolean }
  ): Promise<DeliverResult> {
    const claimed = await prisma.emailOutbox.updateMany({
      where: { id: outboxId, organizationId, status: EmailOutboxStatus.QUEUED },
      data: { status: EmailOutboxStatus.SENDING, attemptCount: { increment: 1 } },
    });
    if (claimed.count === 0) return { status: "skipped", reason: "not_queued", outboxId };

    const item = await prisma.emailOutbox.findFirst({
      where: { id: outboxId, organizationId },
      include: { emailAccount: true, inboundMessage: true },
    });
    if (!item || !item.inboundMessageId || !item.inboundMessage) {
      await prisma.emailOutbox.updateMany({
        where: { id: outboxId },
        data: { status: EmailOutboxStatus.CANCELLED, lastError: "missing_inbound" },
      });
      return { status: "cancelled", reason: "missing_inbound", outboxId };
    }

    const inbound = item.inboundMessage;
    const draft = await prisma.aiReplyDraft.findUnique({
      where: { inboundMessageId: item.inboundMessageId },
    });

    const cancel = async (reason: string, draftStatus?: AiReplyStatus): Promise<DeliverResult> => {
      await prisma.emailOutbox.update({
        where: { id: outboxId },
        data: { status: EmailOutboxStatus.CANCELLED, lastError: reason },
      });
      if (draft && draft.status === AiReplyStatus.QUEUED) {
        await prisma.aiReplyDraft.update({
          where: { id: draft.id },
          data: { status: draftStatus ?? AiReplyStatus.CANCELLED, holdReason: reason },
        });
      }
      return { status: "cancelled", reason, outboxId };
    };

    const hold = async (reason: string): Promise<DeliverResult> => {
      await prisma.emailOutbox.update({
        where: { id: outboxId },
        data: { status: EmailOutboxStatus.HELD, heldReason: reason },
      });
      if (draft) {
        await prisma.aiReplyDraft.update({
          where: { id: draft.id },
          data: { status: AiReplyStatus.HELD, holdReason: reason },
        });
        await this.notifyHeldDraft(organizationId, draft, reason);
      }
      return { status: "held", reason, outboxId };
    };

    if (!draft) return cancel("missing_draft");
    if (draft.status !== AiReplyStatus.QUEUED) return cancel(`draft_${draft.status.toLowerCase()}`, draft.status);

    // Auto path: re-check every guard right before the provider call.
    if (!opts.manual) {
      const [cfg, outbound] = await Promise.all([
        aiReplyConfigService.getConfig(organizationId),
        outboundConfigService.getConfig(organizationId),
      ]);
      if (cfg.killSwitch) return cancel("kill_switch");
      if (cfg.shadow) return cancel("ai_shadow", AiReplyStatus.DRAFT);
      if (outbound.shadowMode) return cancel("outbound_shadow", AiReplyStatus.DRAFT);
      if (cfg.mode !== "AUTO_SEND") return cancel("mode_not_auto_send", AiReplyStatus.DRAFT);

      const sent = await this.sentAiReplyCount(inbound.conversationId);
      if (sent >= cfg.maxRepliesPerConversation) return hold("max_replies_reached");
    }

    // A newer inbound landed after this one → the queued reply is stale.
    const newer = await prisma.message.count({
      where: {
        conversationId: inbound.conversationId,
        direction: MessageDirection.INBOUND,
        id: { not: inbound.id },
        createdAt: { gt: inbound.createdAt },
      },
    });
    if (newer > 0 && !opts.manual) return cancel("superseded_by_newer_inbound");

    if (await emailSafetyService.isSuppressed(organizationId, item.toEmail)) {
      return cancel("suppressed");
    }
    if (item.emailAccount.status !== "ACTIVE") return hold("mailbox_inactive");

    try {
      await entitlementService.assertAndConsume(organizationId, FEATURE_KEYS.EMAILS);
    } catch (err) {
      return hold(`email_quota: ${errMsg(err)}`.slice(0, 200));
    }

    try {
      const sent = await emailProviderService.send(item.emailAccount, {
        to: item.toEmail,
        subject: item.subject,
        text: item.bodyText,
        html: item.bodyHtml ?? undefined,
        inReplyTo: item.inReplyTo,
        references: item.referencesHeader,
      });

      const now = new Date();
      const sentByAi = !(opts.manual && opts.edited);

      let message: Message;
      try {
        message = await prisma.message.create({
          data: {
            organizationId,
            conversationId: inbound.conversationId,
            emailAccountId: item.emailAccountId,
            direction: MessageDirection.OUTBOUND,
            providerMessageId: sent.providerMessageId,
            threadId: sent.threadId ?? inbound.threadId ?? null,
            subject: item.subject,
            body: item.bodyText,
            fromEmail: item.emailAccount.email,
            toEmail: item.toEmail,
            status: EmailStatus.SENT,
            sentByAi,
            sentAt: now,
            idempotencyKey: item.idempotencyKey,
            metadata: asJson({
              aiReplyDraftId: draft.id,
              manual: opts.manual,
              approvedBy: opts.userId ?? null,
              edited: Boolean(opts.edited),
            }),
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          const existing = await prisma.message.findFirst({
            where: { organizationId, idempotencyKey: item.idempotencyKey },
          });
          if (!existing) throw err;
          message = existing;
        } else {
          throw err;
        }
      }

      await prisma.emailOutbox.update({
        where: { id: outboxId },
        data: {
          status: EmailOutboxStatus.SENT,
          sentAt: now,
          messageId: message.id,
          providerMessageId: sent.providerMessageId,
          lastError: null,
        },
      });

      await prisma.aiReplyDraft.update({
        where: { id: draft.id },
        data: {
          status: AiReplyStatus.SENT,
          outboxId,
          outboundMessageId: message.id,
          holdReason: null,
        },
      });

      await prisma.inboxConversation.update({
        where: { id: inbound.conversationId },
        data: {
          // Human-approved replies don't consume the autonomous-AI reply budget.
          ...(opts.manual ? {} : { aiReplyCount: { increment: 1 } }),
          lastMessageAt: now,
          status: InboxConversationStatus.WAITING,
          holdReason: null,
          providerThreadId: sent.threadId ?? undefined,
        },
      });

      await prisma.emailEvent.create({
        data: {
          organizationId,
          messageId: message.id,
          conversationId: inbound.conversationId,
          emailAccountId: item.emailAccountId,
          type: EmailEventType.SENT,
          recipientEmail: item.toEmail,
        },
      });

      if (item.companyId) {
        await timelineService.record({
          organizationId,
          companyId: item.companyId,
          contactId: item.contactId,
          opportunityId: item.opportunityId,
          type: CompanyTimelineEventType.AI_SENT,
          title: opts.manual
            ? `Reply sent${opts.edited ? " (edited)" : ""} from AI draft`
            : "AI reply sent",
          details: { draftId: draft.id, messageId: message.id, manual: opts.manual },
          actor: opts.manual ? TimelineActor.USER : TimelineActor.AI,
          userId: opts.userId ?? null,
          dedupeKey: `ai_sent:${draft.id}`,
        });
      }

      return { status: "sent", outboxId, messageId: message.id };
    } catch (err) {
      const message = errMsg(err).slice(0, 500);
      const attempts = item.attemptCount;
      if (attempts < MAX_SEND_ATTEMPTS && !opts.manual) {
        await prisma.emailOutbox.update({
          where: { id: outboxId },
          data: {
            status: EmailOutboxStatus.QUEUED,
            lastError: message,
            scheduledFor: new Date(Date.now() + 10 * 60_000),
          },
        });
        return { status: "retry", reason: message, outboxId };
      }
      await prisma.emailOutbox.update({
        where: { id: outboxId },
        data: { status: EmailOutboxStatus.FAILED, lastError: message },
      });
      await prisma.aiReplyDraft.update({
        where: { id: draft.id },
        data: { status: AiReplyStatus.HELD, holdReason: "send_failed" },
      });
      await this.notifyHeldDraft(organizationId, draft, `send_failed: ${message}`.slice(0, 200));
      return { status: "failed", reason: message, outboxId };
    }
  }

  private async notifyHeldDraft(organizationId: string, draft: AiReplyDraft, reason: string) {
    try {
      const conv = await prisma.inboxConversation.findFirst({
        where: { id: draft.conversationId, organizationId },
        select: {
          id: true,
          opportunityId: true,
          contact: { select: { fullName: true } },
          company: { select: { name: true } },
        },
      });
      if (!conv) return;
      await notificationService.notifyHeld({
        organizationId,
        conversationId: conv.id,
        opportunityId: conv.opportunityId,
        contactName: conv.contact?.fullName ?? null,
        companyName: conv.company?.name ?? null,
        holdReason: reason,
        classSlug: enumToPhase5Slug(draft.humanOverrideClass ?? draft.class),
      });
    } catch (err) {
      console.warn("[ai-reply] notifyHeldDraft failed", errMsg(err));
    }
  }

  // ───────────────────────────── cron / dashboard ─────────────────────────────

  /**
   * Cron entry. For every org with an aiReply config (or queued AI replies):
   * resume OOO-paused sequences, flush due replies, and send the held digest during the
   * 09:00 Asia/Karachi hour (digest itself is de-duplicated per owner for ~20h).
   */
  async processAllEnabled(now = new Date()) {
    const configured = await aiReplyConfigService.listConfiguredOrganizationIds();
    const queuedOrgs = await prisma.emailOutbox.findMany({
      where: { purpose: EmailOutboxPurpose.AI_REPLY, status: EmailOutboxStatus.QUEUED },
      distinct: ["organizationId"],
      select: { organizationId: true },
    });
    const orgIds = Array.from(
      new Set([...configured, ...queuedOrgs.map((o) => o.organizationId)])
    );

    const karachi = zonedParts(now, DIGEST_TZ);
    const digestWindow = karachi.hour === DIGEST_HOUR;

    const results: Array<{
      organizationId: string;
      flush?: Awaited<ReturnType<AiReplyService["flushDueReplies"]>>;
      oooResumed?: number;
      digest?: { sent: number; owners: number; drafts: number };
      error?: string;
    }> = [];

    for (const organizationId of orgIds) {
      const entry: (typeof results)[number] = { organizationId };
      try {
        const resumed = await sequenceEnrollmentService.resumeDueOooPauses(organizationId, now);
        entry.oooResumed = resumed.resumed;
        entry.flush = await this.flushDueReplies(organizationId);
        if (digestWindow) {
          entry.digest = await notificationService.sendDailyHeldDigest(organizationId);
        }
      } catch (err) {
        entry.error = errMsg(err);
        console.error("[ai-reply.processAll] org failed", { organizationId, error: entry.error });
      }
      results.push(entry);
    }

    return { organizations: orgIds.length, digestWindow, results };
  }

  /** Today's AI reply stats (org-local day). */
  async dashboard(organizationId: string) {
    const [cfg, org, orgSettings] = await Promise.all([
      aiReplyConfigService.getConfig(organizationId),
      prisma.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } }),
      prisma.organizationSettings.findUnique({
        where: { organizationId },
        select: { timezone: true },
      }),
    ]);
    const tz = orgSettings?.timezone || org?.timezone || "UTC";
    const since = startOfLocalDay(new Date(), tz);

    const [
      classified,
      draftsToday,
      sentToday,
      queued,
      held,
      draftsOpen,
      cancelledToday,
      dismissedToday,
      costAgg,
      oldestHeld,
      sentDrafts,
      errorsToday,
      repliesReceived,
    ] = await Promise.all([
      prisma.message.groupBy({
        by: ["aiClassification"],
        where: {
          organizationId,
          direction: MessageDirection.INBOUND,
          aiClassification: { not: null },
          createdAt: { gte: since },
        },
        _count: { _all: true },
      }),
      prisma.aiReplyDraft.count({ where: { organizationId, createdAt: { gte: since } } }),
      prisma.emailOutbox.count({
        where: {
          organizationId,
          purpose: EmailOutboxPurpose.AI_REPLY,
          status: EmailOutboxStatus.SENT,
          sentAt: { gte: since },
        },
      }),
      prisma.aiReplyDraft.count({ where: { organizationId, status: AiReplyStatus.QUEUED } }),
      prisma.aiReplyDraft.count({ where: { organizationId, status: AiReplyStatus.HELD } }),
      prisma.aiReplyDraft.count({ where: { organizationId, status: AiReplyStatus.DRAFT } }),
      prisma.aiReplyDraft.count({
        where: { organizationId, status: AiReplyStatus.CANCELLED, updatedAt: { gte: since } },
      }),
      prisma.aiReplyDraft.count({
        where: { organizationId, status: AiReplyStatus.DISMISSED, dismissedAt: { gte: since } },
      }),
      prisma.aiReplyDraft.aggregate({
        where: { organizationId, createdAt: { gte: since } },
        _sum: { classifyCost: true, draftCost: true },
      }),
      prisma.aiReplyDraft.findFirst({
        where: { organizationId, status: AiReplyStatus.HELD },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      // Response time = inbound received → AI/human reply sent (today's sends)
      prisma.aiReplyDraft.findMany({
        where: {
          organizationId,
          status: AiReplyStatus.SENT,
          outboundMessage: { sentAt: { gte: since } },
        },
        take: 200,
        select: {
          inboundMessage: { select: { receivedAt: true, createdAt: true } },
          outboundMessage: { select: { sentAt: true } },
        },
      }),
      prisma.aiReplyDraft.count({
        where: {
          organizationId,
          updatedAt: { gte: since },
          OR: [
            { holdReason: { in: ["classification_failed", "send_failed", "draft_invalid_json"] } },
            { holdReason: { startsWith: "draft_failed" } },
          ],
        },
      }),
      prisma.message.count({
        where: {
          organizationId,
          direction: MessageDirection.INBOUND,
          createdAt: { gte: since },
        },
      }),
    ]);

    const responseMs = sentDrafts
      .map((d) => {
        const sent = d.outboundMessage?.sentAt?.getTime();
        const got = (d.inboundMessage.receivedAt ?? d.inboundMessage.createdAt).getTime();
        return sent != null ? sent - got : null;
      })
      .filter((n): n is number => n != null && n >= 0);
    const avgResponseMinutes = responseMs.length
      ? Math.round(responseMs.reduce((a, b) => a + b, 0) / responseMs.length / 60_000)
      : null;

    const byClass: Record<string, number> = {};
    for (const row of classified) {
      if (row.aiClassification) byClass[row.aiClassification] = row._count._all;
    }

    return {
      date: since.toISOString(),
      timezone: tz,
      config: {
        mode: cfg.mode,
        killSwitch: cfg.killSwitch,
        shadow: cfg.shadow,
        confidenceThreshold: cfg.confidenceThreshold,
      },
      today: {
        classified: Object.values(byClass).reduce((a, b) => a + b, 0),
        byClass,
        draftsCreated: draftsToday,
        sent: sentToday,
        cancelled: cancelledToday,
        dismissed: dismissedToday,
        replies: repliesReceived,
        errors: errorsToday,
        avgResponseMinutes,
        costUsd:
          Number(costAgg._sum.classifyCost ?? 0) + Number(costAgg._sum.draftCost ?? 0),
      },
      open: {
        queued,
        held,
        drafts: draftsOpen,
        oldestHeldAt: oldestHeld?.createdAt ?? null,
      },
    };
  }
}

export const aiReplyService = new AiReplyService();
