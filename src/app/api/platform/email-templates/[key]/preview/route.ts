import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/api-auth";
import { apiSuccess, NotFoundError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { lifecycleEmailService } from "@/services/billing/lifecycle-email.service";

interface RouteProps {
  params: Promise<{ key: string }>;
}

const bodySchema = z.object({
  subject: z.string().optional(),
  bodyHtml: z.string().optional(),
  bodyText: z.string().optional(),
  vars: z.record(z.string(), z.string()).optional(),
});

export async function POST(request: NextRequest, { params }: RouteProps) {
  try {
    await requireSuperAdmin();
    const { key } = await params;
    const template = await lifecycleEmailService.getTemplate(key);
    if (!template) throw new NotFoundError("Template not found");
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const preview = await lifecycleEmailService.renderBrandedPreview({
      subject: body.subject ?? template.subject,
      bodyHtml: body.bodyHtml ?? template.bodyHtml,
      bodyText: body.bodyText ?? template.bodyText,
      vars: body.vars,
    });
    return NextResponse.json(apiSuccess({ preview }));
  } catch (error) {
    return handleApiError(error);
  }
}
