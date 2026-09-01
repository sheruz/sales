import { conversationService } from "@/services/conversation.service";
import { ConversationsInbox } from "@/components/conversations/conversations-inbox";

export default async function ConversationsPage() {
  const conversations = await conversationService.list();

  const serialized = conversations.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Conversations</h2>
        <p className="text-muted-foreground">
          AI-managed outreach and client replies across LinkedIn and email.
        </p>
      </div>
      <ConversationsInbox initialConversations={serialized} />
    </div>
  );
}
