import { NextRequest, NextResponse } from "next/server";
import { inboxService } from "@/services/inbox.service";
import { requirePermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requirePermission("conversations:read");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const conversation = await inboxService.getConversation(
      user.organizationId,
      id
    );
    return NextResponse.json(apiSuccess(conversation));
  } catch (error) {
    return handleApiError(error);
  }
}
