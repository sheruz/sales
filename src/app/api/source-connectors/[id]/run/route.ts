import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sourceConnectorService } from "@/services/source-connector.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface Params {
  params: Promise<{ id: string }>;
}

const runSchema = z.object({
  count: z.coerce.number().int().positive().max(50).optional(),
  campaignId: z.string().uuid().optional(),
  campaignContext: z.string().max(5000).optional(),
  criteria: z
    .object({
      jobTitles: z.array(z.string()).optional(),
      industries: z.array(z.string()).optional(),
      countries: z.array(z.string()).optional(),
      description: z.string().optional(),
    })
    .optional(),
  focus: z.string().max(500).optional(),
  complianceAcknowledged: z.boolean().optional(),
  rows: z.array(z.record(z.string(), z.unknown())).optional(),
  csvText: z.string().max(2_000_000).optional(),
  companies: z.array(z.string()).optional(),
  /** Official/licensed/customer payloads for Phase 11 connectors */
  records: z.array(z.record(z.string(), z.unknown())).max(500).optional(),
  licensedPayload: z.array(z.record(z.string(), z.unknown())).max(500).optional(),
  events: z.array(z.record(z.string(), z.unknown())).max(500).optional(),
});

export async function POST(request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("opportunities.create");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const body = runSchema.parse(await request.json().catch(() => ({})));
    const result = await sourceConnectorService.run(
      user.organizationId,
      id,
      user.id,
      body
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
