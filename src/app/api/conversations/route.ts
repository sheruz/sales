import { NextRequest, NextResponse } from "next/server";
import { conversationService } from "@/services/conversation.service";
import { inboundReplySchema } from "@/lib/validations/automation";
import { requirePermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("conversations:read");
    const leadId = request.nextUrl.searchParams.get("leadId") ?? undefined;
    const conversations = await conversationService.list({ leadId });
    return NextResponse.json(apiSuccess(conversations));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("conversations:write");
    const body = await request.json();
    const input = inboundReplySchema.parse(body);
    const result = await conversationService.processInboundReply({
      leadId: input.leadId,
      channel: input.channel,
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
