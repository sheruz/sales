import { redirect } from "next/navigation";
import { inboxService } from "@/services/inbox.service";
import { UnifiedInbox } from "@/components/conversations/unified-inbox";
import { getCurrentUser } from "@/lib/auth/session";
import { hasOrgPermission } from "@/lib/tenant/scope";

export default async function ConversationsPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");
  if (!hasOrgPermission(user, "conversations.view")) redirect("/dashboard");

  const conversations = await inboxService.listConversations(
    user.organizationId
  );

  const serialized = conversations.map((c) => ({
    id: c.id,
    subject: c.subject,
    status: c.status,
    sentiment: c.sentiment,
    intent: c.intent,
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    company: c.company,
    contact: c.contact,
    opportunity: c.opportunity,
    messages: c.messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      subject: m.subject,
      body: m.body,
      fromEmail: m.fromEmail,
      toEmail: m.toEmail,
      aiClassification: m.aiClassification,
      aiSummary: m.aiSummary,
      suggestedNextAction: m.suggestedNextAction,
      createdAt: m.createdAt.toISOString(),
      sentAt: m.sentAt?.toISOString() ?? null,
      receivedAt: m.receivedAt?.toISOString() ?? null,
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Inbox</h2>
        <p className="text-muted-foreground">
          Unified inbox — replies link to company, contact, and opportunity when
          those relationships exist.
        </p>
      </div>
      <UnifiedInbox initialConversations={serialized} />
    </div>
  );
}
