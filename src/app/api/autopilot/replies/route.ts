import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { aiReplyService } from "@/services/ai-reply.service";
import { aiReplyConfigService } from "@/services/ai-reply-config.service";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const PERMS = ["campaigns.manage", "business_brain.manage"] as const;

export async function GET() {
  try {
    const user = await requireAnyOrgPermission([...PERMS]);
    const [dashboard, config] = await Promise.all([
      aiReplyService.dashboard(user.organizationId),
      aiReplyConfigService.getConfig(user.organizationId),
    ]);
    return NextResponse.json(apiSuccess({ ...dashboard, config }));
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  mode: z.enum(["OFF", "DRAFT_ONLY", "AUTO_SEND"]).optional(),
  killSwitch: z.boolean().optional(),
  shadow: z.boolean().optional(),
  confidenceThreshold: z.number().min(0.1).max(1).optional(),
  maxRepliesPerConversation: z.number().int().min(1).max(20).optional(),
  autoSendByClass: z
    .object({
      interested: z.boolean().optional(),
      question: z.boolean().optional(),
      not_now: z.boolean().optional(),
    })
    .optional(),
  notInterestedSendClose: z.boolean().optional(),
  nonEnglishHold: z.boolean().optional(),
  classifyModel: z.string().max(120).optional(),
  draftModel: z.string().max(120).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([...PERMS]);
    const { killSwitch, ...rest } = patchSchema.parse(await request.json());

    let config = await aiReplyConfigService.getConfig(user.organizationId);
    if (Object.keys(rest).length > 0) {
      config = await aiReplyConfigService.setConfig(user.organizationId, rest);
    }

    // Kill switch goes through the service so queued AI replies are cancelled when turned ON.
    let kill: { killSwitch: boolean; cancelled: number } | null = null;
    if (killSwitch !== undefined) {
      kill = await aiReplyService.killSwitch(user.organizationId, killSwitch);
      config = await aiReplyConfigService.getConfig(user.organizationId);
    }

    return NextResponse.json(apiSuccess({ config, kill }));
  } catch (error) {
    return handleApiError(error);
  }
}
