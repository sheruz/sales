import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import {
  requireOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { writeAuditLog } from "@/lib/security/audit";

/** GDPR-style org data export (JSON) */
export async function GET() {
  try {
    await requireOrgPermission("organization.update");
    const user = await requireOrganizationContext();
    const orgId = user.organizationId;

    const [
      organization,
      members,
      companies,
      opportunities,
      revenueGoals,
      suppressions,
      auditLogs,
    ] = await Promise.all([
      prisma.organization.findFirst({ where: { id: orgId } }),
      prisma.organizationUser.findMany({
        where: { organizationId: orgId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          role: true,
        },
      }),
      prisma.company.findMany({
        where: { organizationId: orgId },
        take: 5000,
      }),
      prisma.opportunity.findMany({
        where: { organizationId: orgId },
        take: 5000,
      }),
      prisma.revenueGoal.findMany({ where: { organizationId: orgId } }),
      prisma.emailSuppression.findMany({ where: { organizationId: orgId } }),
      prisma.auditLog.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
    ]);

    await writeAuditLog({
      organizationId: orgId,
      userId: user.id,
      action: "privacy.data_export",
      entityType: "organization",
      entityId: orgId,
    });

    return NextResponse.json(
      apiSuccess({
        exportedAt: new Date().toISOString(),
        organization,
        members,
        companies,
        opportunities,
        revenueGoals,
        suppressions,
        auditLogs,
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/** Soft-delete organization (admin) — data retention / deletion request */
export async function DELETE() {
  try {
    await requireOrgPermission("organization.update");
    const user = await requireOrganizationContext();
    const orgId = user.organizationId;

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        status: "CANCELLED",
        deletedAt: new Date(),
        name: `[deleted] ${Date.now()}`,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      userId: user.id,
      action: "privacy.org_delete_requested",
      entityType: "organization",
      entityId: orgId,
    });

    return NextResponse.json(apiSuccess({ deleted: true, organizationId: orgId }));
  } catch (error) {
    return handleApiError(error);
  }
}
