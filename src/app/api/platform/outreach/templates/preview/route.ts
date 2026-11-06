import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformRead } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { platformOutreachService } from "@/services/platform-outreach.service";

const schema = z.object({
  templateId: z.string().uuid(),
  contactId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    await requirePlatformRead();
    const body = schema.parse(await request.json());
    const preview = await platformOutreachService.previewTemplate(
      body.templateId,
      body.contactId
    );
    return NextResponse.json(
      apiSuccess({
        subject: preview.subject,
        bodyText: preview.bodyText,
        contactId: preview.contact.id,
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
