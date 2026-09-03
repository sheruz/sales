import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OrganizationStatus } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { organizationService } from "@/services/organization.service";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess, ForbiddenError, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { ROLE_KEYS } from "@/lib/auth/permission-catalog";

export async function GET() {
  try {
    const user = await requireOrgPermission("users.view");
    const organizationId = user.organizationId;
    if (!organizationId) throw new ForbiddenError("No active organization");

    const members = await organizationService.listMembers(organizationId);
    return NextResponse.json(apiSuccess(members));
  } catch (error) {
    return handleApiError(error);
  }
}

const inviteSchema = z.object({
  email: z.string().email(),
  roleKey: z.enum([
    ROLE_KEYS.COMPANY_ADMIN,
    ROLE_KEYS.SALES_MANAGER,
    ROLE_KEYS.SALES_REP,
    ROLE_KEYS.VIEWER,
  ]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireOrgPermission("users.invite");
    const organizationId = user.organizationId;
    if (!organizationId) throw new ForbiddenError("No active organization");

    const org = await prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
    });
    if (!org) throw new ValidationError("Organization not found");
    if (org.status !== OrganizationStatus.ACTIVE) {
      throw new ValidationError("Organization is not active");
    }

    const body = inviteSchema.parse(await request.json());
    const invite = await organizationService.inviteMember({
      organizationId,
      email: body.email,
      roleKey: body.roleKey,
      invitedById: user.id,
    });

    await organizationService.writeAudit({
      organizationId,
      userId: user.id,
      action: "organization.invite",
      entityType: "organization_invitation",
      newValues: { email: body.email, roleKey: body.roleKey },
    });

    return NextResponse.json(apiSuccess(invite), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
