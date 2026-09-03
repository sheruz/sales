import { NextResponse } from "next/server";
import { inboxService } from "@/services/inbox.service";
import { requirePermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { env } from "@/lib/config/env";

/** Polling sync for all org Gmail/Outlook accounts */
export async function POST(request: Request) {
  try {
    const cronSecret = request.headers.get("x-cron-secret");
    if (env.CRON_SECRET && cronSecret === env.CRON_SECRET) {
      // Platform cron: sync all orgs with active OAuth accounts
      const prisma = (await import("@/lib/db/prisma")).default;
      const orgs = await prisma.emailAccount.findMany({
        where: {
          status: "ACTIVE",
          provider: { in: ["GMAIL", "OUTLOOK"] },
        },
        select: { organizationId: true },
        distinct: ["organizationId"],
      });
      const results = [];
      for (const org of orgs) {
        results.push({
          organizationId: org.organizationId,
          runs: await inboxService.syncAllForOrg(org.organizationId),
        });
      }
      return NextResponse.json(apiSuccess({ results }));
    }

    await requirePermission("integrations:manage");
    const user = await requireOrganizationContext();
    const results = await inboxService.syncAllForOrg(user.organizationId);
    return NextResponse.json(apiSuccess({ results }));
  } catch (error) {
    return handleApiError(error);
  }
}
