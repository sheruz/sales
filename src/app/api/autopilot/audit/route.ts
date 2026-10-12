import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PitchReviewMode } from "@prisma/client";
import { websiteAuditService } from "@/services/website-audit.service";
import { cronTickService } from "@/services/cron-tick.service";
import {
  requireAnyOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const SOURCING_PERMS = [
  "integrations.manage",
  "campaigns.manage",
  "business_brain.manage",
] as const;

export async function GET() {
  try {
    await requireAnyOrgPermission([...SOURCING_PERMS]);
    const user = await requireOrganizationContext();
    const [data, lastTick] = await Promise.all([
      websiteAuditService.dashboard(user.organizationId),
      cronTickService.lastTick(),
    ]);
    return NextResponse.json(
      apiSuccess({
        ...data,
        lastCronRun: lastTick
          ? {
              id: lastTick.id,
              startedAt: lastTick.startedAt.toISOString(),
              finishedAt: lastTick.finishedAt?.toISOString() ?? null,
              ok: lastTick.ok,
              skipped: lastTick.skipped,
              skipReason: lastTick.skipReason,
              counts: lastTick.counts,
              stale: cronTickService.isStale(lastTick),
            }
          : null,
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  batchPerTick: z.number().int().min(1).max(5).optional(),
  dailyLimit: z.number().int().min(1).max(500).optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  pitchReviewMode: z
    .enum([PitchReviewMode.AUTO_APPROVE, PitchReviewMode.REVIEW_REQUIRED])
    .optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    await requireAnyOrgPermission([...SOURCING_PERMS]);
    const user = await requireOrganizationContext();
    const body = patchSchema.parse(await request.json());
    const config = await websiteAuditService.setConfig(
      user.organizationId,
      body
    );
    return NextResponse.json(apiSuccess({ config }));
  } catch (error) {
    return handleApiError(error);
  }
}
