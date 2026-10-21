import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminWrite } from "@/lib/auth/api-auth";
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
  toEmail: z.string().email().optional(),
});

export async function POST(request: NextRequest, { params }: RouteProps) {
  try {
    const user = await requireSuperAdminWrite();
    const { key } = await params;
    const template = await lifecycleEmailService.getTemplate(key);
    if (!template) throw new NotFoundError("Template not found");
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const to = body.toEmail || user.email;
    if (!to) throw new Error("No email on your account for test send");
    const result = await lifecycleEmailService.sendTestToSelf({
      templateKey: key,
      toEmail: to,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      bodyText: body.bodyText,
      actorUserId: user.id,
    });
    return NextResponse.json(apiSuccess({ ...result, to }));
  } catch (error) {
    return handleApiError(error);
  }
}
