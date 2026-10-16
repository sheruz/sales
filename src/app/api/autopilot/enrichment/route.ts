import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enrichmentJobService } from "@/services/enrichment-job.service";
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
      // Live Hunter balance for this org's key (no cache)
      enrichmentJobService.dashboard(user.organizationId, user.id),
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
      }),
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  batchPerTick: z.number().int().min(1).max(25).optional(),
  dailyCreditLimit: z.number().int().min(1).max(10000).optional(),
  allowAcceptAll: z.boolean().optional(),
  titlePriority: z.array(z.string().min(1).max(80)).max(40).optional(),
  domainBlocklist: z.array(z.string().min(1).max(120)).max(100).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    await requireAnyOrgPermission([...SOURCING_PERMS]);
    const user = await requireOrganizationContext();
    const body = patchSchema.parse(await request.json());
    const config = await enrichmentJobService.setConfig(
      user.organizationId,
      body
    );
    return NextResponse.json(apiSuccess({ config }));
  } catch (error) {
    return handleApiError(error);
  }
}
