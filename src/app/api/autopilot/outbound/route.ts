import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { outboundJobService } from "@/services/outbound-job.service";
import { cronTickService } from "@/services/cron-tick.service";
import {
  requireAnyOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const PERMS = [
  "integrations.manage",
  "campaigns.manage",
  "business_brain.manage",
] as const;

export async function GET() {
  try {
    await requireAnyOrgPermission([...PERMS]);
    const user = await requireOrganizationContext();
    await outboundJobService.ensureColdOutreachSequence(user.organizationId);
    const [data, lastTick] = await Promise.all([
      outboundJobService.dashboard(user.organizationId),
      cronTickService.lastTick(),
    ]);
    return NextResponse.json(
      apiSuccess({
        ...data,
        lastCronRun: lastTick
          ? {
              startedAt: lastTick.startedAt.toISOString(),
              finishedAt: lastTick.finishedAt?.toISOString() ?? null,
              ok: lastTick.ok,
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
  shadowMode: z.boolean().optional(),
  dailyGlobalCap: z.number().int().min(1).max(500).optional(),
  countryAllowList: z.array(z.string().min(1).max(80)).max(40).optional(),
  allowAcceptAll: z.boolean().optional(),
  physicalAddress: z.string().max(500).optional(),
  businessName: z.string().max(200).optional(),
  disableLegacySends: z.boolean().optional(),
  maxEnrollPerTick: z.number().int().min(1).max(25).optional(),
  maxSendPerTick: z.number().int().min(1).max(25).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    await requireAnyOrgPermission([...PERMS]);
    const user = await requireOrganizationContext();
    const body = patchSchema.parse(await request.json());
    const config = await outboundJobService.setConfig(
      user.organizationId,
      body
    );
    return NextResponse.json(apiSuccess({ config }));
  } catch (error) {
    return handleApiError(error);
  }
}
