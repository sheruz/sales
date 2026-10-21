import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminWrite } from "@/lib/auth/api-auth";
import { apiSuccess, NotFoundError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { lifecycleEmailService } from "@/services/billing/lifecycle-email.service";
import { organizationService } from "@/services/organization.service";

interface RouteProps {
  params: Promise<{ key: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteProps) {
  try {
    const user = await requireSuperAdminWrite();
    const { key } = await params;
    const before = await lifecycleEmailService.getTemplate(key);
    if (!before) throw new NotFoundError("Template not found");
    const template = await lifecycleEmailService.resetTemplate(key, user.id);
    await organizationService.writePlatformAudit({
      actorUserId: user.id,
      action: "email_template.reset",
      targetType: "email_template",
      targetId: key,
      before: { subject: before.subject },
      after: { subject: template.subject },
    });
    return NextResponse.json(apiSuccess({ template }));
  } catch (error) {
    return handleApiError(error);
  }
}
