import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { aiReplyService } from "@/services/ai-reply.service";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface Params {
  params: Promise<{ id: string }>;
}

/** id = AiReplyDraft id */
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send") }),
  z.object({
    action: z.literal("edit_send"),
    replyText: z.string().min(1).max(6000),
  }),
  z.object({ action: z.literal("regenerate") }),
  z.object({ action: z.literal("insert_booking") }),
  z.object({ action: z.literal("dismiss") }),
  z.object({
    action: z.literal("reclassify"),
    class: z.string().min(1).max(40),
  }),
]);

function serialize<T extends { replyText: string }>(draft: T) {
  return JSON.parse(JSON.stringify(draft)) as T;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    // Sending / editing replies requires conversations.manage (viewers are read-only).
    const user = await requireOrgPermission("conversations.manage");
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    const org = user.organizationId;

    let draft;
    switch (body.action) {
      case "send":
        draft = await aiReplyService.sendDraft(id, org, user.id);
        break;
      case "edit_send":
        draft = await aiReplyService.sendDraft(id, org, user.id, {
          editText: body.replyText,
        });
        break;
      case "regenerate":
        draft = await aiReplyService.regenerate(id, org, user.id);
        break;
      case "insert_booking":
        draft = await aiReplyService.insertBookingLink(id, org);
        break;
      case "dismiss":
        draft = await aiReplyService.dismiss(id, org, user.id);
        break;
      case "reclassify":
        draft = await aiReplyService.reclassify(id, org, body.class, user.id);
        break;
    }

    return NextResponse.json(apiSuccess({ draft: serialize(draft) }));
  } catch (error) {
    return handleApiError(error);
  }
}
