import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireSuperAdmin,
  requireSuperAdminWrite,
} from "@/lib/auth/api-auth";
import { apiSuccess, NotFoundError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { lifecycleEmailService } from "@/services/billing/lifecycle-email.service";
import { organizationService } from "@/services/organization.service";

interface RouteProps {
  params: Promise<{ key: string }>;
}

const patchSchema = z.object({
  subject: z.string().min(1).max(500).optional(),
  bodyHtml: z.string().min(1).max(100_000).optional(),
  bodyText: z.string().min(1).max(50_000).optional(),
});

export async function GET(_request: NextRequest, { params }: RouteProps) {
  try {
    await requireSuperAdmin();
    const { key } = await params;
    const t = await lifecycleEmailService.getTemplate(key);
    if (!t) throw new NotFoundError("Template not found");
    const preview = await lifecycleEmailService.renderBrandedPreview({
      subject: t.subject,
      bodyHtml: t.bodyHtml,
      bodyText: t.bodyText,
    });
    return NextResponse.json(
      apiSuccess({
        template: {
          id: t.id,
          key: t.key,
          name: t.name,
          subject: t.subject,
          bodyHtml: t.bodyHtml,
          bodyText: t.bodyText,
          variables: t.variables,
          defaultSubject: t.defaultSubject,
          defaultBodyHtml: t.defaultBodyHtml,
          defaultBodyText: t.defaultBodyText,
          updatedAt: t.updatedAt,
          updatedById: t.updatedById,
        },
        preview,
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteProps) {
  try {
    const user = await requireSuperAdminWrite();
    const { key } = await params;
    const body = patchSchema.parse(await request.json());
    const before = await lifecycleEmailService.getTemplate(key);
    if (!before) throw new NotFoundError("Template not found");
    const template = await lifecycleEmailService.updateTemplate(
      key,
      body,
      user.id
    );
    await organizationService.writePlatformAudit({
      actorUserId: user.id,
      action: "email_template.updated",
      targetType: "email_template",
      targetId: key,
      before: {
        subject: before.subject,
        bodyHtml: before.bodyHtml.slice(0, 200),
      },
      after: {
        subject: template.subject,
        bodyHtml: template.bodyHtml.slice(0, 200),
      },
    });
    return NextResponse.json(apiSuccess({ template }));
  } catch (error) {
    return handleApiError(error);
  }
}
