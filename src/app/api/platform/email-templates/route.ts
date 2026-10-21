import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { lifecycleEmailService } from "@/services/billing/lifecycle-email.service";

export async function GET() {
  try {
    await requireSuperAdmin();
    const templates = await lifecycleEmailService.listTemplates();
    return NextResponse.json(
      apiSuccess({
        templates: templates.map((t) => ({
          id: t.id,
          key: t.key,
          name: t.name,
          subject: t.subject,
          bodyHtml: t.bodyHtml,
          bodyText: t.bodyText,
          variables: t.variables,
          updatedAt: t.updatedAt,
          updatedById: t.updatedById,
          isCustomized:
            t.subject !== t.defaultSubject ||
            t.bodyHtml !== t.defaultBodyHtml ||
            t.bodyText !== t.defaultBodyText,
        })),
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
