import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SourceConnectorStatus } from "@prisma/client";
import { sourceConnectorService } from "@/services/source-connector.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("integrations.manage");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const connector = await sourceConnectorService.getById(
      user.organizationId,
      id
    );
    return NextResponse.json(apiSuccess(connector));
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.nativeEnum(SourceConnectorStatus).optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
  credentials: z.record(z.string(), z.string()).nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("integrations.manage");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const connector = await sourceConnectorService.update(
      user.organizationId,
      id,
      body
    );
    return NextResponse.json(apiSuccess(connector));
  } catch (error) {
    return handleApiError(error);
  }
}
