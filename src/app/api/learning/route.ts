import { NextRequest, NextResponse } from "next/server";
import { learningService } from "@/services/learning.service";
import { requirePermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { env } from "@/lib/config/env";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("analytics:read");
    const user = await requireOrganizationContext();
    const patterns = request.nextUrl.searchParams.get("patterns") === "1";
    if (patterns) {
      const data = await learningService.discoverPatterns(user.organizationId);
      return NextResponse.json(apiSuccess(data));
    }
    const events = await learningService.list(user.organizationId);
    return NextResponse.json(apiSuccess(events));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Cron or manual refresh of learning patterns → optional recommendations */
export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get("x-cron-secret");
    if (env.CRON_SECRET && cronSecret === env.CRON_SECRET) {
      const prisma = (await import("@/lib/db/prisma")).default;
      const orgs = await prisma.organization.findMany({
        where: { deletedAt: null, status: "ACTIVE" },
        select: { id: true },
        take: 100,
      });
      const results = [];
      for (const org of orgs) {
        results.push({
          organizationId: org.id,
          ...(await learningService.discoverPatterns(org.id)),
        });
      }
      return NextResponse.json(apiSuccess({ results }));
    }

    await requirePermission("analytics:read");
    const user = await requireOrganizationContext();
    const data = await learningService.discoverPatterns(user.organizationId);
    return NextResponse.json(apiSuccess(data));
  } catch (error) {
    return handleApiError(error);
  }
}
