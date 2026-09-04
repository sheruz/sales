import { NextResponse } from "next/server";
import { inboxService } from "@/services/inbox.service";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

/** Polling sync for all org Gmail/Outlook accounts */
export async function POST(request: Request) {
  try {
    const isCron =
      request.headers.get("x-cron-secret") ||
      request.headers.get("authorization");
    if (isCron) {
      assertCronAuthorized(request);
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

    const user = await requireOrgPermission("integrations.manage");
    const results = await inboxService.syncAllForOrg(user.organizationId);
    return NextResponse.json(apiSuccess({ results }));
  } catch (error) {
    return handleApiError(error);
  }
}
