import { NextRequest, NextResponse } from "next/server";
import { EmailSendStatus } from "@prisma/client";
import { requireSuperAdmin } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { lifecycleEmailService } from "@/services/billing/lifecycle-email.service";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteProps) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as EmailSendStatus | null;
    const templateKey = searchParams.get("templateKey") || undefined;
    const take = Math.min(Number(searchParams.get("take") || 50), 200);
    const skip = Math.max(Number(searchParams.get("skip") || 0), 0);

    const result = await lifecycleEmailService.listSends({
      organizationId: id,
      templateKey,
      status: status || undefined,
      take,
      skip,
    });
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
