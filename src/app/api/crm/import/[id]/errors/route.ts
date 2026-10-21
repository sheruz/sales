import { NextRequest, NextResponse } from "next/server";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
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
    const csv = await crmImportService.getErrorCsv(user.organizationId, id);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="import-errors-${id.slice(0, 8)}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
