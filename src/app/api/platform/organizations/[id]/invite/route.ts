import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { organizationService } from "@/services/organization.service";
import { requireSuperAdmin } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { env } from "@/lib/config/env";

const bodySchema = z.object({
  action: z.enum(["resend", "cancel", "change_email", "copy_link"]),
  email: z.string().email().optional(),
});

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await ctx.params;
    const body = bodySchema.parse(await request.json());

    if (body.action === "resend") {
      const result = await organizationService.resendInvite(id, actor.id);
      return NextResponse.json(apiSuccess(result));
    }
    if (body.action === "cancel") {
      const result = await organizationService.cancelInvite(id, actor.id);
      return NextResponse.json(apiSuccess(result));
    }
    if (body.action === "change_email") {
      if (!body.email) {
        return NextResponse.json(
          { success: false, error: { message: "email required" } },
          { status: 400 }
        );
      }
      const result = await organizationService.changeOwnerInviteEmail(
        id,
        body.email,
        actor.id
      );
      return NextResponse.json(apiSuccess(result));
    }
    // copy_link = resend token without requiring SMTP success
    const result = await organizationService.resendInvite(id, actor.id);
    return NextResponse.json(
      apiSuccess({
        ...result,
        inviteLink: `${env.APP_URL}/invite?token=${result.token}`,
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
