import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import {
  requireOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { handleApiError } from "@/lib/api/error-handler";
import { privacyExportService } from "@/services/privacy-export.service";
import { writeAuditLog } from "@/lib/security/audit";

interface RouteProps {
  params: Promise<{ token: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteProps) {
  try {
    await requireOrgPermission("organization.update");
    const user = await requireOrganizationContext();
    const { token } = await params;
    const job = await privacyExportService.getDownloadable(
      token,
      user.organizationId
    );
    const buf = await readFile(job.filePath!);

    await writeAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "privacy.data_export_download",
      entityType: "data_export_job",
      entityId: job.id,
    });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="org-export-${job.id.slice(0, 8)}.zip"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
