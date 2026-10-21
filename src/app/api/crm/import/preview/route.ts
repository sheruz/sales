import { NextRequest, NextResponse } from "next/server";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { crmImportService } from "@/services/crm-import.service";
import type { ColumnMapping } from "@/lib/crm/import/types";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "opportunities.create",
      "leads.create",
    ]);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: { message: "CSV file is required" } },
        { status: 400 }
      );
    }

    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: { message: "CSV must be under 5MB" } },
        { status: 400 }
      );
    }

    const mappingRaw = formData.get("mapping");
    let mapping: ColumnMapping | undefined;
    if (typeof mappingRaw === "string" && mappingRaw.trim()) {
      mapping = JSON.parse(mappingRaw) as ColumnMapping;
    }

    const auditRaw = formData.get("runAuditAfterImport");
    const runAuditAfterImport =
      auditRaw === null || auditRaw === undefined
        ? true
        : String(auditRaw) !== "false" && String(auditRaw) !== "0";

    const text = await file.text();
    const result = await crmImportService.preview({
      organizationId: user.organizationId,
      userId: user.id,
      fileName: file.name || "import.csv",
      csvText: text,
      mapping,
      runAuditAfterImport,
    });

    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
