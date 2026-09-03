import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { organizationService } from "@/services/organization.service";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess, ForbiddenError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { ROLE_KEYS } from "@/lib/auth/permission-catalog";

interface Params {
  params: Promise<{ userId: string }>;
}

const patchSchema = z.object({
  roleKey: z
    .enum([
      ROLE_KEYS.COMPANY_ADMIN,
      ROLE_KEYS.SALES_MANAGER,
      ROLE_KEYS.SALES_REP,
      ROLE_KEYS.VIEWER,
    ])
    .optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const actor = await requireOrgPermission("users.update");
    const organizationId = actor.organizationId;
    if (!organizationId) throw new ForbiddenError("No active organization");

    const { userId } = await params;
    const body = patchSchema.parse(await request.json());

    if (body.roleKey) {
      await organizationService.changeMemberRole(
        organizationId,
        userId,
        body.roleKey
      );
    }

    if (body.status === "DISABLED") {
      await organizationService.deactivateMember(
        organizationId,
        userId,
        actor.id
      );
    } else if (body.status === "ACTIVE") {
      await organizationService.reactivateMember(organizationId, userId);
    }

    await organizationService.writeAudit({
      organizationId,
      userId: actor.id,
      action: "organization.member.update",
      entityType: "organization_user",
      entityId: userId,
      newValues: body,
    });

    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const actor = await requireOrgPermission("users.delete");
    const organizationId = actor.organizationId;
    if (!organizationId) throw new ForbiddenError("No active organization");

    const { userId } = await params;
    await organizationService.deactivateMember(
      organizationId,
      userId,
      actor.id
    );

    await organizationService.writeAudit({
      organizationId,
      userId: actor.id,
      action: "organization.member.deactivate",
      entityType: "organization_user",
      entityId: userId,
    });

    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (error) {
    return handleApiError(error);
  }
}
