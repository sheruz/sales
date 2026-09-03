import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, requireOrgPermission } from "@/lib/auth/api-auth";
import {
  getSessionTokenFromCookies,
  setActiveOrganization,
  getSessionUser,
} from "@/lib/auth/session";
import { apiSuccess, ForbiddenError, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import prisma from "@/lib/db/prisma";

/** List organizations the current user can access */
export async function GET() {
  try {
    const user = await requireUser();
    if (user.isPlatformAdmin) {
      const orgs = await prisma.organization.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, slug: true, status: true },
        orderBy: { name: "asc" },
      });
      return NextResponse.json(apiSuccess(orgs));
    }

    const memberships = await prisma.organizationUser.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, status: true, deletedAt: true },
        },
      },
    });

    const orgs = memberships
      .filter(
        (m) =>
          !m.organization.deletedAt &&
          m.organization.status !== "SUSPENDED" &&
          m.organization.status !== "CANCELLED"
      )
      .map((m) => m.organization);

    return NextResponse.json(apiSuccess(orgs));
  } catch (error) {
    return handleApiError(error);
  }
}

const switchSchema = z.object({
  organizationId: z.string().uuid(),
});

/** Switch active organization for the current session */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const { organizationId } = switchSchema.parse(await request.json());
    const token = await getSessionTokenFromCookies();
    if (!token) throw new ForbiddenError();

    if (!user.isPlatformAdmin) {
      const membership = await prisma.organizationUser.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: user.id },
        },
      });
      if (!membership || membership.status !== "ACTIVE") {
        throw new ValidationError("Not a member of this organization");
      }
    }

    await setActiveOrganization(token, organizationId);
    const refreshed = await getSessionUser(token);
    return NextResponse.json(apiSuccess(refreshed));
  } catch (error) {
    return handleApiError(error);
  }
}

// silence unused import if tree-shaken oddly
void requireOrgPermission;
