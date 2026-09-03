import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { organizationService } from "@/services/organization.service";
import { requireOrgPermission, requireSuperAdmin } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { ROLE_KEYS } from "@/lib/auth/permission-catalog";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireOrgPermission("users.view").catch(async () =>
      requireSuperAdmin()
    );
    if (!user.isPlatformAdmin && user.organizationId !== id) {
      await requireSuperAdmin();
    }
    const members = await organizationService.listMembers(id);
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

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireOrgPermission("users.invite").catch(async () =>
      requireSuperAdmin()
    );
    if (!user.isPlatformAdmin && user.organizationId !== id) {
      await requireSuperAdmin();
    }
    const body = inviteSchema.parse(await request.json());
    const invite = await organizationService.inviteMember({
      organizationId: id,
      email: body.email,
      roleKey: body.roleKey,
      invitedById: user.id,
    });
    await organizationService.writeAudit({
      organizationId: id,
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
