import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requirePlatformRead,
  requirePlatformOutreachWrite,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { platformOutreachService } from "@/services/platform-outreach.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    await requirePlatformRead();
    const { id } = await ctx.params;
    const campaign = await platformOutreachService.getCampaign(id);
    return NextResponse.json(apiSuccess({ campaign }));
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pause") }),
  z.object({
    action: z.literal("review"),
    contactIds: z.array(z.string().uuid()).min(1).max(200),
  }),
  z.object({
    action: z.literal("launch"),
    mode: z.enum(["now", "window"]).default("window"),
  }),
  z.object({
    action: z.literal("edit_recipient"),
    contactId: z.string().uuid(),
    subject: z.string().min(1).max(300).optional(),
    bodyText: z.string().min(1).max(20000).optional(),
  }),
]);

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requirePlatformOutreachWrite();
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());

    if (body.action === "pause") {
      const campaign = await platformOutreachService.pauseCampaign(id, user.id);
      return NextResponse.json(apiSuccess({ campaign }));
    }
    if (body.action === "review") {
      const result = await platformOutreachService.buildReview({
        campaignId: id,
        contactIds: body.contactIds,
        actorUserId: user.id,
      });
      return NextResponse.json(apiSuccess(result));
    }
    if (body.action === "launch") {
      const result = await platformOutreachService.launchCampaign({
        campaignId: id,
        mode: body.mode,
        actorUserId: user.id,
      });
      return NextResponse.json(apiSuccess(result));
    }
    const recipient = await platformOutreachService.updateRecipient(
      id,
      body.contactId,
      { subject: body.subject, bodyText: body.bodyText }
    );
    return NextResponse.json(apiSuccess({ recipient }));
  } catch (error) {
    return handleApiError(error);
  }
}
