import { redirect } from "next/navigation";
import { conversationService } from "@/services/conversation.service";
import { ConversationsInbox } from "@/components/conversations/conversations-inbox";
import { getCurrentUser } from "@/lib/auth/session";

export default async function ConversationsPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");

  const conversations = await conversationService.list(user.organizationId);

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
