import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { powPitchService } from "@/services/pow-pitch.service";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("regenerate") }),
  z.object({ action: z.literal("recheck") }),
  z.object({
    action: z.literal("edit"),
    steps: z
      .array(
        z.object({
          day: z.union([
            z.literal(0),
            z.literal(3),
            z.literal(7),
            z.literal(14),
          ]),
          subject: z.string().min(1).max(80),
          body: z.string().min(1).max(5000),
        })
      )
      .min(4)
      .max(4),
  }),
]);

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    await requireOrgPermission("organization.view");
    const user = await requireOrganizationContext();
    const { id } = await ctx.params;
    const body = actionSchema.parse(await request.json());

    if (body.action === "approve") {
      const pitch = await powPitchService.approve(
        user.organizationId,
        id,
        user.id
      );
      return NextResponse.json(apiSuccess(pitch));
    }
    if (body.action === "regenerate") {
      const data = await powPitchService.regenerate(
        user.organizationId,
        id,
        user.id
      );
      return NextResponse.json(apiSuccess(data));
    }
    if (body.action === "recheck") {
      const data = await powPitchService.recheckBeforeSend(
        user.organizationId,
        id
      );
      return NextResponse.json(apiSuccess(data));
    }
    const pitch = await powPitchService.edit(
      user.organizationId,
      id,
      user.id,
      body.steps
    );
    return NextResponse.json(apiSuccess(pitch));
  } catch (error) {
    return handleApiError(error);
  }
}
