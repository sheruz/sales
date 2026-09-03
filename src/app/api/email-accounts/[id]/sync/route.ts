import { NextRequest, NextResponse } from "next/server";
import { inboxService } from "@/services/inbox.service";
import { requirePermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    await requirePermission("integrations:manage");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const result = await inboxService.syncAccount(
      user.organizationId,
      id,
      user.id
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
