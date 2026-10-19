import { NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { planPauseService } from "@/services/plan-pause.service";

export async function GET() {
  try {
    const user = await requireOrgPermission("billing.manage");
    const notices = await planPauseService.listPendingNotices(
      user.organizationId
    );
    const enriched = [];
    for (const n of notices) {
      const resources = await planPauseService.listActiveResources(
        user.organizationId,
        n.featureKey
      );
      enriched.push({ ...n, resources });
    }
    return NextResponse.json(apiSuccess({ notices: enriched }));
  } catch (error) {
    return handleApiError(error);
  }
}
