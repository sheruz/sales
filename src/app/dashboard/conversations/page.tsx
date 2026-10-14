import { redirect } from "next/navigation";
import { inboxService } from "@/services/inbox.service";
import { UnifiedInbox } from "@/components/conversations/unified-inbox";
import { getCurrentUser } from "@/lib/auth/session";
import { hasOrgPermission } from "@/lib/tenant/scope";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ conversationId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");
  if (!hasOrgPermission(user, "conversations.view")) redirect("/dashboard");

  const { conversationId } = await searchParams;

  const conversations = await inboxService.listConversations(
    user.organizationId
  );

  const serialized = conversations.map((c) => {
    const d = c.aiReplyDrafts[0] ?? null;
    return {
      id: c.id,
      subject: c.subject,
      status: c.status,
      sentiment: c.sentiment,
      intent: c.intent,
      lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
      latestClass: c.latestClass,
      latestConfidence:
        c.latestConfidence != null ? Number(c.latestConfidence) : null,
      holdReason: c.holdReason,
      aiReplyCount: c.aiReplyCount,
      company: c.company,
      contact: c.contact,
      opportunity: c.opportunity,
      aiReplyDraft: d
        ? {
            id: d.id,
            status: d.status,
            class: d.humanOverrideClass ?? d.class,
            confidence: Number(d.confidence),
            holdReason: d.holdReason,
            replyText: d.replyText,
            offersBooking: d.offersBooking,
            scheduledFor: d.scheduledFor?.toISOString() ?? null,
          }
        : null,
      messages: c.messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        subject: m.subject,
        body: m.body,
        bodyHtml: m.bodyHtml,
        fromEmail: m.fromEmail,
        toEmail: m.toEmail,
        status: m.status,
        aiClassification: m.aiClassification,
        aiConfidence: m.aiConfidence != null ? Number(m.aiConfidence) : null,
        aiSummary: m.aiSummary,
        holdReason: m.holdReason,
        sentByAi: m.sentByAi,
        suggestedNextAction: m.suggestedNextAction,
        createdAt: m.createdAt.toISOString(),
        sentAt: m.sentAt?.toISOString() ?? null,
        receivedAt: m.receivedAt?.toISOString() ?? null,
      })),
    };
  });

  const initialSelectedId =
    conversationId && serialized.some((c) => c.id === conversationId)
      ? conversationId
      : undefined;

  return (
    <div className="dx">
      <div className="page">
        <UnifiedInbox
          initialConversations={serialized}
          initialSelectedId={initialSelectedId}
        />
      </div>
    </div>
  );
}
