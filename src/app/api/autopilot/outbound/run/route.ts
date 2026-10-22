import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { outboundJobService } from "@/services/outbound-job.service";
import {
  requireAnyOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const schema = z.object({
  action: z.enum(["enroll", "send", "tick"]).default("tick"),
  limit: z.number().int().min(1).max(10).optional(),
});

/** Manual small-batch enroll/send — works even when Outbound toggle is OFF. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "integrations.manage",
      "campaigns.manage",
      "business_brain.manage",
    ]);
    await requireOrganizationContext();
    const body = schema.parse(await request.json().catch(() => ({})));
    const limit = body.limit ?? 3;

    if (body.action === "enroll") {
      const result = await outboundJobService.autoEnrollBatch(
        user.organizationId,
        limit,
        user.id
      );
      return NextResponse.json(apiSuccess(result));
    }
    if (body.action === "send") {
      // Manual Process outbox: bypass Mon–Fri send window for delay-elapsed
      // rows (e.g. step 1). Still never burns day-3/day-7 early.
      const result = await outboundJobService.processOutboxBatch(
        user.organizationId,
        limit,
        { manual: true }
      );
      return NextResponse.json(apiSuccess(result));
    }
    const enroll = await outboundJobService.autoEnrollBatch(
      user.organizationId,
      limit,
      user.id
    );
    const send = await outboundJobService.processOutboxBatch(
      user.organizationId,
      limit
    );
    return NextResponse.json(apiSuccess({ enroll, send }));
  } catch (error) {
    return handleApiError(error);
  }
}
