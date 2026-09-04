import { NextRequest, NextResponse } from "next/server";
import { leadMigrationService } from "@/services/lead-migration.service";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** On-demand Lead → Company/Contact bridge (idempotent, non-destructive). */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAnyOrgPermission([
      "leads.update",
      "opportunities.create",
    ]);
    const { id } = await params;
    const result = await leadMigrationService.bridgeLead(
      user.organizationId,
      id
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
