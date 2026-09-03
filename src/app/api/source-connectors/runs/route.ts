import { NextRequest, NextResponse } from "next/server";
import { sourceConnectorService } from "@/services/source-connector.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET(request: NextRequest) {
  try {
    await requireOrgPermission("integrations.manage");
    const user = await requireOrganizationContext();
    const connectorId =
      request.nextUrl.searchParams.get("connectorId") || undefined;
    const runs = await sourceConnectorService.listRuns(
      user.organizationId,
      connectorId
    );
    return NextResponse.json(apiSuccess(runs));
  } catch (error) {
    return handleApiError(error);
  }
}
