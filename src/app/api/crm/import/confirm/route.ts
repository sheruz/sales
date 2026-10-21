import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { crmImportService } from "@/services/crm-import.service";

const bodySchema = z.object({
  jobId: z.string().uuid(),
  mapping: z.record(z.string(), z.string()).optional(),
  runAuditAfterImport: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "opportunities.create",
      "leads.create",
    ]);
    const json = await request.json();
    const body = bodySchema.parse(json);

    const result = await crmImportService.confirm({
      organizationId: user.organizationId,
      userId: user.id,
      jobId: body.jobId,
      mapping: body.mapping as Partial<Record<string, string>> | undefined,
      runAuditAfterImport: body.runAuditAfterImport,
    });

    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
