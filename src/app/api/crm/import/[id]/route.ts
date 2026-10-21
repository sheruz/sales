import { NextRequest, NextResponse } from "next/server";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { crmImportService } from "@/services/crm-import.service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAnyOrgPermission([
      "opportunities.view",
      "leads.view",
    ]);
    const { id } = await context.params;
    const job = await crmImportService.getJob(user.organizationId, id);
    return NextResponse.json(apiSuccess(job));
  } catch (error) {
    return handleApiError(error);
  }
}
