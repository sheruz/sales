import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SuppressionReason } from "@prisma/client";
import { emailSafetyService } from "@/services/email-safety.service";
import { requirePermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    await requirePermission("integrations:manage");
    const user = await requireOrganizationContext();
    const items = await emailSafetyService.listSuppressions(user.organizationId);
    return NextResponse.json(apiSuccess(items));
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  email: z.string().email().optional().nullable(),
  domain: z.string().min(1).max(255).optional().nullable(),
  reason: z.nativeEnum(SuppressionReason),
  source: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requirePermission("integrations:manage");
    const user = await requireOrganizationContext();
    const input = schema.parse(await request.json());
    const item = await emailSafetyService.suppress({
      organizationId: user.organizationId,
      ...input,
      source: input.source ?? "manual",
    });
    return NextResponse.json(apiSuccess(item), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
