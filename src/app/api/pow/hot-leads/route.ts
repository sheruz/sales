import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/require-module";
import { MODULE_KEYS } from "@/lib/billing/modules";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { powPreviewPageService } from "@/services/pow-preview-page.service";

export async function GET() {
  try {
    const user = await requireModule(MODULE_KEYS.PROOF_OF_WORK, {
      permission: "organization.view",
    });
    const rows = await powPreviewPageService.listHotLeads(user.organizationId);
    return NextResponse.json(
      apiSuccess(
        rows.map((r) => ({
          id: r.id,
          publicSlug: r.publicSlug,
          visitCount: r.visitCount,
          firstHumanVisitAt: r.firstHumanVisitAt,
          lastHumanVisitAt: r.lastHumanVisitAt,
          totalDwellMs: r.totalDwellMs,
          company: r.company,
          contact: r.contact,
          pitch: r.pitch,
        }))
      )
    );
  } catch (error) {
    return handleApiError(error);
  }
}
