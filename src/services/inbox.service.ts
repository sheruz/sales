import crypto from "crypto";
import prisma from "@/lib/db/prisma";
import {
  EmailEventType,
  EmailProvider,
  EmailStatus,
  InboxConversationStatus,
  MessageAiClassification,
  MessageDirection,
  SuppressionReason,
  type EmailAccount,
} from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { aiComplete, parseAIJson } from "@/lib/ai/provider";
import { emailAccountService } from "@/services/email-account.service";
import { emailProviderService } from "@/services/email-provider.service";
import { emailSafetyService } from "@/services/email-safety.service";
import { entitlementService } from "@/services/entitlement.service";
import { FEATURE_KEYS } from "@/lib/billing/features";
import { sanitizeExternalForAI } from "@/lib/security/untrusted-content";
import {
  contactEmailMatchWhere,
  extractEmailAddress,
  extractGmailBodies,
  normalizeMessageId,
  parseMessageIdList,
  summarizeSyncResults,
} from "@/lib/email/inbound-sync";

type InboundNormalized = {
  providerMessageId: string;
  threadId?: string | null;
  subject?: string | null;
  body?: string | null;
  bodyHtml?: string | null;
  fromEmail: string;
  toEmail: string;
  receivedAt?: Date;
  inReplyTo?: string | null;
  references?: string | null;
  /** RFC Message-ID header (for In-Reply-To threading on AI replies) */
  rfcMessageId?: string | null;
  autoSubmitted?: string | null;
  xAutoreply?: string | null;
  precedence?: string | null;
};

type ClassificationResult = {
  classification: string;
  sentiment: string;
  intent: string;
  summary: string;
  suggestedNextAction: string;
};

function mapClassification(raw: string): MessageAiClassification {
  const key = raw.trim().toUpperCase().replace(/\s+/g, "_");
  const allowed = Object.values(MessageAiClassification) as string[];
  if (allowed.includes(key)) return key as MessageAiClassification;
  if (key.includes("INTEREST")) return MessageAiClassification.INTERESTED;
  if (key.includes("POSITIVE")) return MessageAiClassification.POSITIVE;
  if (key.includes("NEGATIVE") || key.includes("NOT_INTEREST"))
    return MessageAiClassification.NEGATIVE;
  if (key.includes("OBJECT")) return MessageAiClassification.OBJECTION;
  if (key.includes("QUESTION")) return MessageAiClassification.QUESTION;
  if (key.includes("UNSUB")) return MessageAiClassification.UNSUBSCRIBE;
  if (key.includes("OOO") || key.includes("OUT_OF_OFFICE"))
    return MessageAiClassification.OUT_OF_OFFICE;
  if (key.includes("REFERRAL")) return MessageAiClassification.REFERRAL;
  if (key.includes("NOT_RELEVANT") || key.includes("IRRELEVANT"))
    return MessageAiClassification.NOT_RELEVANT;
  return MessageAiClassification.UNKNOWN;
}

export class InboxService {
  async listConversations(organizationId: string, take = 50) {
    return prisma.inboxConversation.findMany({
      where: { organizationId },
      include: {
        company: { select: { id: true, name: true, domain: true } },
        contact: {
          select: { id: true, fullName: true, email: true, title: true },
        },
        opportunity: { select: { id: true, stage: true, score: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        aiReplyDrafts: { orderBy: { createdAt: "desc" }, take: 1 },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take,
    });
  }

  async getConversation(organizationId: string, id: string) {
    const conversation = await prisma.inboxConversation.findFirst({
      where: { id, organizationId },
      include: {
        company: true,
        contact: true,
        opportunity: true,
        lead: { select: { id: true, fullName: true, email: true } },
        messages: { orderBy: { createdAt: "asc" } },
        aiReplyDrafts: { orderBy: { createdAt: "desc" }, take: 1 },
        events: { orderBy: { occurredAt: "desc" }, take: 50 },
        emailAccount: {
          select: {
            id: true,
            email: true,
            provider: true,
            status: true,
          },
        },
      },
    });
    if (!conversation) throw new NotFoundError("Conversation not found");
    return conversation;
  }

  async sendOutreach(input: {
    organizationId: string;
    userId: string;
    toEmail: string;
    subject: string;
    body: string;
    bodyHtml?: string;
    companyId?: string | null;
    contactId?: string | null;
    opportunityId?: string | null;
    leadId?: string | null;
    conversationId?: string | null;
    emailAccountId?: string | null;
    idempotencyKey: string;
    headers?: Record<string, string>;
    inReplyTo?: string | null;
    references?: string | null;
  }) {
    const account = input.emailAccountId
      ? await emailAccountService.getById(
          input.organizationId,
          input.emailAccountId
        )
      : await emailAccountService.getDefaultForUser(
          input.organizationId,
          input.userId
        );
    if (!account) {
      throw new ValidationError(
        "Connect Gmail, Outlook, or SMTP before sending email"
      );
    }

    // Idempotent resume: never call provider again for an already-SENT message.
    const existingByKey = await prisma.message.findFirst({
      where: {
        organizationId: input.organizationId,
        idempotencyKey: input.idempotencyKey,
      },
    });
    if (
      existingByKey &&
      ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED"].includes(
        existingByKey.status
      )
    ) {
      return {
        conversationId: existingByKey.conversationId,
        message: existingByKey,
        resumed: true as const,
      };
    }

    // Under org advisory lock: enforce daily limit + create/reuse draft (SCHEDULED).
    // SCHEDULED rows count toward the org daily quota so concurrent workers cannot oversubscribe.
    let conversationId = input.conversationId ?? existingByKey?.conversationId ?? null;
    let draftId: string;

    try {
      const prepared = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock(hashtext($1::text))`,
          input.organizationId
        );

        const safety = await emailSafetyService.assertCanSend({
          organizationId: input.organizationId,
          account,
          toEmail: input.toEmail,
          idempotencyKey: input.idempotencyKey,
          allowExistingIdempotencyKey: Boolean(existingByKey),
          tx,
        });
        if (!safety.ok) {
          throw new ValidationError(safety.reason, {
            safetyCode: safety.code ?? "OTHER",
          });
        }

        let convId = conversationId;
        if (!convId) {
          const created = await tx.inboxConversation.create({
            data: {
              organizationId: input.organizationId,
              companyId: input.companyId,
              contactId: input.contactId,
              opportunityId: input.opportunityId,
              leadId: input.leadId,
              emailAccountId: account.id,
              channel: "EMAIL",
              subject: input.subject,
              status: InboxConversationStatus.WAITING,
              assignedToId: input.userId,
              lastMessageAt: new Date(),
            },
          });
          convId = created.id;
        }

        if (existingByKey) {
          await tx.message.update({
            where: { id: existingByKey.id },
            data: {
              status: EmailStatus.SCHEDULED,
              subject: input.subject,
              body: input.body,
              bodyHtml: input.bodyHtml,
              metadata: { resumeAttempt: true },
            },
          });
          return { conversationId: convId, draftId: existingByKey.id };
        }

        const draft = await tx.message.create({
          data: {
            organizationId: input.organizationId,
            conversationId: convId,
            emailAccountId: account.id,
            direction: MessageDirection.OUTBOUND,
            subject: input.subject,
            body: input.body,
            bodyHtml: input.bodyHtml,
            fromEmail: account.email,
            toEmail: input.toEmail.trim().toLowerCase(),
            status: EmailStatus.SCHEDULED,
            idempotencyKey: input.idempotencyKey,
          },
        });
        return { conversationId: convId, draftId: draft.id };
      });
      conversationId = prepared.conversationId;
      draftId = prepared.draftId;
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      // Unique violation on idempotency → load and resume if already SENT
      const raced = await prisma.message.findFirst({
        where: {
          organizationId: input.organizationId,
          idempotencyKey: input.idempotencyKey,
        },
      });
      if (
        raced &&
        ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED"].includes(
          raced.status
        )
      ) {
        return {
          conversationId: raced.conversationId,
          message: raced,
          resumed: true as const,
        };
      }
      throw err;
    }

    await entitlementService.assertAndConsume(
      input.organizationId,
      FEATURE_KEYS.EMAILS
    );

    try {
      const sent = await emailProviderService.send(account, {
        to: input.toEmail,
        subject: input.subject,
        text: input.body,
        html: input.bodyHtml,
        headers: input.headers,
        inReplyTo: input.inReplyTo,
        references: input.references,
      });

      const message = await prisma.message.update({
        where: { id: draftId },
        data: {
          status: EmailStatus.SENT,
          providerMessageId: sent.providerMessageId,
          threadId: sent.threadId,
          sentAt: new Date(),
        },
      });

      await prisma.inboxConversation.update({
        where: { id: conversationId! },
        data: {
          lastMessageAt: new Date(),
          providerThreadId: sent.threadId ?? undefined,
          status: InboxConversationStatus.WAITING,
        },
      });

      await prisma.emailEvent.create({
        data: {
          organizationId: input.organizationId,
          messageId: message.id,
          conversationId: conversationId!,
          emailAccountId: account.id,
          type: EmailEventType.SENT,
          recipientEmail: input.toEmail.trim().toLowerCase(),
        },
      });

      // Increment account daily counter once per message (retries must not double-count)
      const sentEvents = await prisma.emailEvent.count({
        where: { messageId: message.id, type: EmailEventType.SENT },
      });
      if (sentEvents === 1) {
        await emailSafetyService.incrementDailySent(account.id);
      }

      if (input.leadId) {
        await prisma.conversation.create({
          data: {
            organizationId: input.organizationId,
            leadId: input.leadId,
            channel: "EMAIL",
            subject: input.subject,
            content: input.body,
            isInbound: false,
            metadata: {
              inboxConversationId: conversationId,
              messageId: message.id,
            },
          },
        });
      }

      return { conversationId: conversationId!, message, resumed: false as const };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Send failed";
      await prisma.message.update({
        where: { id: draftId },
        data: { status: EmailStatus.FAILED, metadata: { error: errMsg } },
      });
      await prisma.emailEvent.create({
        data: {
          organizationId: input.organizationId,
          messageId: draftId,
          conversationId: conversationId!,
          emailAccountId: account.id,
          type: EmailEventType.FAILED,
          recipientEmail: input.toEmail.trim().toLowerCase(),
          metadata: { error: errMsg },
        },
      });
      await emailAccountService.markError(account.id, errMsg);
      throw error;
    }
  }

  async ingestInbound(
    organizationId: string,
    account: EmailAccount,
    inbound: InboundNormalized,
    userId?: string
  ) {
    const existing = await prisma.message.findFirst({
      where: {
        organizationId,
        providerMessageId: inbound.providerMessageId,
      },
    });
    if (existing) return { message: existing, created: false };

    const from = inbound.fromEmail.trim().toLowerCase();
    const contact = await prisma.contact.findFirst({
      where: contactEmailMatchWhere(organizationId, from),
      include: { company: true },
    });
    const lead = await prisma.lead.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { email: { equals: from, mode: "insensitive" } },
        ],
      },
    });
    const opportunity = contact
      ? await prisma.opportunity.findFirst({
          where: {
            organizationId,
            OR: [
              { primaryContactId: contact.id },
              { recommendedContactId: contact.id },
              { companyId: contact.companyId },
            ],
          },
          orderBy: { updatedAt: "desc" },
        })
      : lead
        ? await prisma.opportunity.findFirst({
            where: { organizationId, leadId: lead.id },
          })
        : null;

    let conversation = inbound.threadId
      ? await prisma.inboxConversation.findFirst({
          where: {
            organizationId,
            providerThreadId: inbound.threadId,
          },
        })
      : null;

    // Match via In-Reply-To / References → existing outbound Message-ID (SMTP + Gmail)
    if (!conversation) {
      const replyIds = [
        normalizeMessageId(inbound.inReplyTo),
        ...parseMessageIdList(inbound.references ?? undefined),
      ].filter((id): id is string => Boolean(id));

      for (const replyId of replyIds) {
        const related = await prisma.message.findFirst({
          where: {
            organizationId,
            OR: [
              { providerMessageId: replyId },
              { providerMessageId: `<${replyId}>` },
              { providerMessageId: { equals: replyId, mode: "insensitive" } },
            ],
          },
          select: { conversationId: true },
        });
        if (related?.conversationId) {
          conversation = await prisma.inboxConversation.findFirst({
            where: { id: related.conversationId, organizationId },
          });
          if (conversation) break;
        }
      }
    }

    if (!conversation && contact) {
      conversation = await prisma.inboxConversation.findFirst({
        where: {
          organizationId,
          contactId: contact.id,
          channel: "EMAIL",
          status: { not: InboxConversationStatus.CLOSED },
        },
        orderBy: { lastMessageAt: "desc" },
      });
    }

    // Fallback: open thread that already emailed this address (SMTP outbound often lacks threadId)
    if (!conversation) {
      const priorOutbound = await prisma.message.findFirst({
        where: {
          organizationId,
          direction: MessageDirection.OUTBOUND,
          toEmail: from,
        },
        orderBy: { sentAt: "desc" },
        select: { conversationId: true },
      });
      if (priorOutbound?.conversationId) {
        conversation = await prisma.inboxConversation.findFirst({
          where: {
            id: priorOutbound.conversationId,
            organizationId,
            status: { not: InboxConversationStatus.CLOSED },
          },
        });
      }
    }

    if (!conversation) {
      conversation = await prisma.inboxConversation.create({
        data: {
          organizationId,
          companyId: contact?.companyId ?? lead?.companyId,
          contactId: contact?.id,
          opportunityId: opportunity?.id,
          leadId: lead?.id,
          emailAccountId: account.id,
          channel: "EMAIL",
          subject: inbound.subject,
          providerThreadId: inbound.threadId,
          status: InboxConversationStatus.NEEDS_ACTION,
          lastMessageAt: inbound.receivedAt ?? new Date(),
        },
      });
    }

    const message = await prisma.message.create({
      data: {
        organizationId,
        conversationId: conversation.id,
        emailAccountId: account.id,
        direction: MessageDirection.INBOUND,
        providerMessageId: inbound.providerMessageId,
        threadId: inbound.threadId,
        subject: inbound.subject,
        body: inbound.body,
        bodyHtml: inbound.bodyHtml,
        fromEmail: from,
        toEmail: inbound.toEmail.trim().toLowerCase(),
        status: EmailStatus.DELIVERED,
        receivedAt: inbound.receivedAt ?? new Date(),
      },
    });

    await prisma.emailEvent.create({
      data: {
        organizationId,
        messageId: message.id,
        conversationId: conversation.id,
        emailAccountId: account.id,
        type: EmailEventType.REPLIED,
        recipientEmail: account.email,
      },
    });

    await prisma.inboxConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: inbound.receivedAt ?? new Date(),
        status: InboxConversationStatus.NEEDS_ACTION,
        nextActionAt: new Date(),
        companyId: conversation.companyId ?? contact?.companyId ?? lead?.companyId,
        contactId: conversation.contactId ?? contact?.id,
        opportunityId: conversation.opportunityId ?? opportunity?.id,
        leadId: conversation.leadId ?? lead?.id,
        subject: conversation.subject ?? inbound.subject,
        emailAccountId: conversation.emailAccountId ?? account.id,
      },
    });

    // Refresh conversation for AI reply handler
    conversation =
      (await prisma.inboxConversation.findFirst({
        where: { id: conversation.id, organizationId },
      })) ?? conversation;

    const { aiReplyService } = await import("@/services/ai-reply.service");
    const ai = await aiReplyService.handleInbound({
      organizationId,
      userId,
      message,
      conversation,
      contact,
      company: contact?.company ?? null,
      opportunity,
      headers: {
        subject: inbound.subject,
        autoSubmitted: inbound.autoSubmitted,
        xAutoreply: inbound.xAutoreply,
        precedence: inbound.precedence,
        messageId: inbound.rfcMessageId,
        references: inbound.references,
      },
    });

    const classification =
      ai.classification ?? MessageAiClassification.OTHER;

    // Bounce / complaint signals from mailbox (provider webhooks may also feed suppressions)
    const bodyLower = `${inbound.subject || ""} ${inbound.body || ""}`.toLowerCase();
    if (
      bodyLower.includes("delivery status notification") ||
      bodyLower.includes("mail delivery failed") ||
      bodyLower.includes("undeliverable")
    ) {
      await emailSafetyService.suppress({
        organizationId,
        email: from,
        reason: SuppressionReason.BOUNCE,
        source: "bounce_detection",
      });
    }
    if (
      bodyLower.includes("abuse report") ||
      bodyLower.includes("spam complaint") ||
      bodyLower.includes("feedback-type: abuse")
    ) {
      await emailSafetyService.suppress({
        organizationId,
        email: from,
        reason: SuppressionReason.COMPLAINT,
        source: "complaint_detection",
      });
    }

    if (lead) {
      await prisma.conversation.create({
        data: {
          organizationId,
          leadId: lead.id,
          channel: "EMAIL",
          subject: inbound.subject,
          content: inbound.body,
          isInbound: true,
          summary: ai.classification
            ? `Classified: ${ai.classification}`
            : null,
          metadata: {
            inboxConversationId: conversation.id,
            messageId: message.id,
            classification,
            aiOutcome: ai.outcome,
          },
        },
      });
    }

    return { message, conversation, created: true, classification, ai };
  }

  async classifyReply(input: {
    organizationId: string;
    userId?: string;
    body: string;
    subject?: string | null;
  }): Promise<ClassificationResult> {
    try {
      const result = await aiComplete({
        feature: "inbox_reply_classification",
        purpose: "inbox_reply_classification",
        operation: "inbox_reply_classification",
        organizationId: input.organizationId,
        userId: input.userId,
        jsonMode: true,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `Classify inbound sales email replies. Return ONLY JSON:
{
  "classification": "interested|positive|negative|objection|question|unsubscribe|out_of_office|not_relevant|referral|unknown",
  "sentiment": string,
  "intent": string,
  "summary": string,
  "suggestedNextAction": string
}`,
          },
          {
            role: "user",
            content: sanitizeExternalForAI(
              "email_reply",
              `Subject: ${input.subject || ""}\n\n${input.body}`
            ),
          },
        ],
      });
      return parseAIJson<ClassificationResult>(result.content);
    } catch {
      return {
        classification: "unknown",
        sentiment: "unknown",
        intent: "unknown",
        summary: "Classification unavailable",
        suggestedNextAction: "Review manually and reply if appropriate",
      };
    }
  }

  async syncAccount(organizationId: string, accountId: string, userId?: string) {
    const account = await emailAccountService.getById(organizationId, accountId);
    if (account.provider === EmailProvider.SMTP) {
      await emailAccountService.markSynced(account.id);
      return {
        synced: 0,
        total: 0,
        provider: account.provider,
        skipped: true as const,
        note: "SMTP is outbound-only — connect Gmail or Outlook OAuth to sync inbound replies",
      };
    }

    try {
      const inbound =
        account.provider === EmailProvider.GMAIL
          ? await this.fetchGmailInbound(account)
          : await this.fetchOutlookInbound(account);

      console.info("[inbox.sync]", {
        organizationId,
        accountId: account.id,
        provider: account.provider,
        fetched: inbound.length,
      });

      let synced = 0;
      let duplicates = 0;
      for (const item of inbound) {
        const result = await this.ingestInbound(
          organizationId,
          account,
          item,
          userId
        );
        if (result.created) synced += 1;
        else duplicates += 1;
      }
      await emailAccountService.markSynced(account.id);
      console.info("[inbox.sync.done]", {
        organizationId,
        accountId: account.id,
        synced,
        duplicates,
        fetched: inbound.length,
      });
      return {
        synced,
        total: inbound.length,
        duplicates,
        provider: account.provider,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Sync failed";
      console.error("[inbox.sync.error]", {
        organizationId,
        accountId: account.id,
        provider: account.provider,
        error: msg,
      });
      await emailAccountService.markError(account.id, msg);
      throw error;
    }
  }

  async syncAllForOrg(organizationId: string) {
    const [oauthAccounts, smtpAccountsSkipped] = await Promise.all([
      prisma.emailAccount.findMany({
        where: {
          organizationId,
          status: "ACTIVE",
          provider: { in: [EmailProvider.GMAIL, EmailProvider.OUTLOOK] },
        },
      }),
      prisma.emailAccount.count({
        where: {
          organizationId,
          status: "ACTIVE",
          provider: EmailProvider.SMTP,
        },
      }),
    ]);

    const results: Array<Record<string, unknown>> = [];
    for (const account of oauthAccounts) {
      try {
        results.push({
          accountId: account.id,
          ...(await this.syncAccount(organizationId, account.id, account.userId)),
        });
      } catch (error) {
        results.push({
          accountId: account.id,
          error: error instanceof Error ? error.message : "failed",
          synced: 0,
          total: 0,
        });
      }
    }

    const summary = summarizeSyncResults(
      results as Array<{ synced?: number; total?: number; error?: string }>,
      {
        smtpAccountsSkipped,
        oauthAccountCount: oauthAccounts.length,
      }
    );

    return {
      results,
      ...summary,
      smtpAccountsSkipped,
      oauthAccountCount: oauthAccounts.length,
    };
  }

  private async fetchGmailInbound(account: EmailAccount): Promise<InboundNormalized[]> {
    const token = await emailProviderService.ensureFreshAccessToken(account);
    // Include primary inbox; replies to outreach land in INBOX for the sending mailbox
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=40&q=" +
        encodeURIComponent("in:inbox newer_than:14d"),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!listRes.ok) {
      throw new Error(`Gmail list failed: ${await listRes.text()}`);
    }
    const list = (await listRes.json()) as { messages?: Array<{ id: string }> };
    const out: InboundNormalized[] = [];
    for (const item of list.messages ?? []) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!msgRes.ok) continue;
      const msg = (await msgRes.json()) as {
        id: string;
        threadId?: string;
        internalDate?: string;
        snippet?: string;
        labelIds?: string[];
        payload?: {
          mimeType?: string;
          headers?: Array<{ name: string; value: string }>;
          body?: { data?: string };
          parts?: Array<{
            mimeType?: string;
            body?: { data?: string };
            parts?: unknown[];
          }>;
        };
      };
      const headers = msg.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
      const from = getHeader("From") || "";
      const to = getHeader("To") || account.email;
      const subject = getHeader("Subject");
      const inReplyTo = getHeader("In-Reply-To") || null;
      const references = getHeader("References") || null;
      const rfcMessageId = getHeader("Message-ID") || getHeader("Message-Id") || null;
      const autoSubmitted = getHeader("Auto-Submitted") || null;
      const xAutoreply =
        getHeader("X-Autoreply") || getHeader("X-Auto-Response-Suppress") || null;
      const precedence = getHeader("Precedence") || null;
      const fromEmail = extractEmailAddress(from);
      // Skip mail that originated from this mailbox (SENT copies / self-send)
      if (!fromEmail || fromEmail === account.email.toLowerCase()) {
        continue;
      }
      const bodies = extractGmailBodies(msg.payload);
      const body = bodies.text || msg.snippet || bodies.html || "";
      out.push({
        providerMessageId: msg.id,
        threadId: msg.threadId,
        subject,
        body,
        bodyHtml: bodies.html,
        fromEmail,
        toEmail: extractEmailAddress(to) || account.email.toLowerCase(),
        receivedAt: msg.internalDate
          ? new Date(Number(msg.internalDate))
          : new Date(),
        inReplyTo,
        references,
        rfcMessageId,
        autoSubmitted,
        xAutoreply,
        precedence,
      });
    }
    return out;
  }

  private async fetchOutlookInbound(account: EmailAccount): Promise<InboundNormalized[]> {
    const token = await emailProviderService.ensureFreshAccessToken(account);
    const res = await fetch(
      "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=25&$orderby=receivedDateTime desc&$select=id,conversationId,subject,body,bodyPreview,from,toRecipients,receivedDateTime",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      throw new Error(`Outlook list failed: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      value?: Array<{
        id: string;
        conversationId?: string;
        subject?: string;
        bodyPreview?: string;
        body?: { contentType?: string; content?: string };
        from?: { emailAddress?: { address?: string } };
        toRecipients?: Array<{ emailAddress?: { address?: string } }>;
        receivedDateTime?: string;
      }>;
    };
    const out: InboundNormalized[] = [];
    for (const msg of data.value ?? []) {
      const fromEmail = extractEmailAddress(
        msg.from?.emailAddress?.address || ""
      );
      if (!fromEmail || fromEmail === account.email.toLowerCase()) {
        continue;
      }
      const html =
        msg.body?.contentType?.toLowerCase() === "html"
          ? msg.body.content
          : null;
      out.push({
        providerMessageId: msg.id,
        threadId: msg.conversationId,
        subject: msg.subject,
        body: msg.bodyPreview || msg.body?.content || "",
        bodyHtml: html,
        fromEmail,
        toEmail:
          extractEmailAddress(
            msg.toRecipients?.[0]?.emailAddress?.address || ""
          ) || account.email.toLowerCase(),
        receivedAt: msg.receivedDateTime
          ? new Date(msg.receivedDateTime)
          : new Date(),
      });
    }
    return out;
  }

  newIdempotencyKey(prefix = "send"): string {
    return `${prefix}_${crypto.randomUUID()}`;
  }
}

export const inboxService = new InboxService();
