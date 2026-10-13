import { NextRequest, NextResponse } from "next/server";
import {
  requireAnyOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { emailBrandingService } from "@/services/email-branding.service";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "integrations.manage",
      "business_brain.manage",
      "campaigns.manage",
    ]);
    await requireOrganizationContext();

    const form = await request.formData();
    const kind = String(form.get("kind") || "");
    const mailboxId = form.get("mailboxId")
      ? String(form.get("mailboxId"))
      : undefined;
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new ValidationError("file is required");
    }
    if (
      kind !== "logo" &&
      kind !== "sender" &&
      kind !== "mailbox_sender"
    ) {
      throw new ValidationError("kind must be logo, sender, or mailbox_sender");
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const result = await emailBrandingService.uploadImage(
      user.organizationId,
      kind,
      buf,
      { mailboxId }
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
