import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sourcingJobService } from "@/services/sourcing-job.service";
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
    const data = await sourcingJobService.dashboard(user.organizationId);
    return NextResponse.json(
      apiSuccess({
        ...data,
        queries: data.queries.map((q) => ({
          ...q,
          lastRunAt: q.lastRunAt?.toISOString() ?? null,
          createdAt: q.createdAt.toISOString(),
          updatedAt: q.updatedAt.toISOString(),
        })),
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  autoCrawl: z.boolean().optional(),
  queriesPerDay: z.number().int().min(1).max(100).optional(),
  companiesPerDay: z.number().int().min(1).max(500).optional(),
  queriesPerTick: z.number().int().min(1).max(5).optional(),
  crawlsPerTick: z.number().int().min(1).max(20).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    await requireAnyOrgPermission([...SOURCING_PERMS]);
    const user = await requireOrganizationContext();
    const body = patchSchema.parse(await request.json());
    const config = await sourcingJobService.setConfig(
      user.organizationId,
      body
    );
    return NextResponse.json(apiSuccess({ config }));
  } catch (error) {
    return handleApiError(error);
  }
}
