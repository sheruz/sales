import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    await requireOrgPermission("leads.view");
    const user = await requireOrganizationContext();
    const tags = await prisma.tag.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(apiSuccess(tags));
  } catch (error) {
    return handleApiError(error);
  }
}
