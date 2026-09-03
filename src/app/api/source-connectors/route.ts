import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SourceConnectorType } from "@prisma/client";
import { sourceConnectorService } from "@/services/source-connector.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    await requireOrgPermission("integrations.manage");
    const user = await requireOrganizationContext();
    const [connectors, catalog] = await Promise.all([
      sourceConnectorService.list(user.organizationId),
      Promise.resolve(sourceConnectorService.catalog()),
    ]);
    return NextResponse.json(apiSuccess({ connectors, catalog }));
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  type: z.nativeEnum(SourceConnectorType),
  name: z.string().min(1).max(200),
  provider: z.string().max(100).optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
  credentials: z.record(z.string(), z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireOrgPermission("integrations.manage");
    const user = await requireOrganizationContext();
    const body = createSchema.parse(await request.json());
    const connector = await sourceConnectorService.create(
      user.organizationId,
      body
    );
    return NextResponse.json(apiSuccess(connector), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
