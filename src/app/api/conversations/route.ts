import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { inboxService } from "@/services/inbox.service";
import { conversationService } from "@/services/conversation.service";
import { requirePermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { ConversationChannel } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("conversations:read");
    const user = await requireOrganizationContext();
    const legacy = request.nextUrl.searchParams.get("legacy") === "1";
    if (legacy) {
      const conversations = await conversationService.list(user.organizationId);
      return NextResponse.json(apiSuccess(conversations));
    }
    const conversations = await inboxService.listConversations(
      user.organizationId
    );
    return NextResponse.json(apiSuccess(conversations));
  } catch (error) {
    return handleApiError(error);
  }
}

const sendSchema = z.object({
  toEmail: z.string().email(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(50000),
  bodyHtml: z.string().max(100000).optional(),
  companyId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  opportunityId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  conversationId: z.string().uuid().optional().nullable(),
  emailAccountId: z.string().uuid().optional().nullable(),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

/** Legacy simulate inbound OR send outbound based on body shape */
const legacyInboundSchema = z.object({
  leadId: z.string().uuid(),
  channel: z.nativeEnum(ConversationChannel).optional(),
  content: z.string().min(1),
  subject: z.string().optional(),
  autoRespond: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requirePermission("conversations:write");
    const user = await requireOrganizationContext();
    const raw = await request.json();

    if ("toEmail" in raw && "body" in raw) {
      const input = sendSchema.parse(raw);
      const result = await inboxService.sendOutreach({
        organizationId: user.organizationId,
        userId: user.id,
        ...input,
        idempotencyKey:
          input.idempotencyKey ?? inboxService.newIdempotencyKey(),
      });
      return NextResponse.json(apiSuccess(result), { status: 201 });
    }

    const input = legacyInboundSchema.parse(raw);
    const result = await conversationService.processInboundReply({
      organizationId: user.organizationId,
      leadId: input.leadId,
      channel: input.channel ?? ConversationChannel.EMAIL,
      content: input.content,
      subject: input.subject,
      userId: user.id,
      autoRespond: input.autoRespond,
    });
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
