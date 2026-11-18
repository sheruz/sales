import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { ForbiddenError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { toCsv } from "@/lib/export/zip-store";
import {
  canCompanyAdminExportLeads,
  LEAD_EXPORT_COLUMNS,
  parseLeadExportRange,
} from "@/lib/leads/export-leads";
import { contactService } from "@/services/contact.service";

/** Date-range CSV of this organization's leads. Company admin only. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireOrgPermission("leads.view");
    if (!canCompanyAdminExportLeads(user)) {
      throw new ForbiddenError("Only a company admin can export leads");
    }

    const from = request.nextUrl.searchParams.get("from") ?? "";
    const to = request.nextUrl.searchParams.get("to") ?? "";
    const range = parseLeadExportRange(from, to);
    const rows = await contactService.exportCreatedBetween(
      user.organizationId,
      range
    );
    const csv = toCsv(
      rows as unknown as Record<string, unknown>[],
      [...LEAD_EXPORT_COLUMNS]
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${from}-to-${to}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
