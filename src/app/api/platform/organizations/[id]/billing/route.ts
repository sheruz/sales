import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminWrite } from "@/lib/auth/api-auth";
import { apiSuccess, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { organizationService } from "@/services/organization.service";
import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";

const schema = z.object({
  billingProvider: z
    .enum(["PADDLE", "MANUAL_PAYONEER", "MANUAL_BANK"])
    .optional(),
  billingEmail: z.string().email().nullable().optional().or(z.literal("")),
  reason: z.string().min(1),
});

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireSuperAdminWrite();
    const { id: organizationId } = await ctx.params;
    if (organizationId === env.PLATFORM_OWNER_ORG_ID) {
      throw new ValidationError("Cannot change Delvix billing settings");
    }
    const body = schema.parse(await request.json());
    const before = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { billingProvider: true, billingEmail: true },
    });
    if (!before) throw new ValidationError("Organization not found");

    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(body.billingProvider
          ? { billingProvider: body.billingProvider }
          : {}),
        ...(body.billingEmail !== undefined
          ? {
              billingEmail:
                body.billingEmail === "" || body.billingEmail === null
                  ? null
                  : body.billingEmail,
            }
          : {}),
      },
      select: { id: true, billingProvider: true, billingEmail: true },
    });

    await organizationService.writePlatformAudit({
      actorUserId: actor.id,
      action: "tenant.billing_updated",
      targetType: "organization",
      targetId: organizationId,
      organizationId,
      before,
      after: updated,
      reason: body.reason,
    });

    return NextResponse.json(apiSuccess(updated));
  } catch (error) {
    return handleApiError(error);
  }
}
