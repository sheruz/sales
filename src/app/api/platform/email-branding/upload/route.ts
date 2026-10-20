import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminWrite } from "@/lib/auth/api-auth";
import { apiSuccess, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { platformEmailBrandingService } from "@/services/platform-email-branding.service";

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdminWrite();
    const form = await request.formData();
    const kind = String(form.get("kind") || "");
    const file = form.get("file");
    if (kind !== "logo" && kind !== "sender") {
      throw new ValidationError("kind must be logo or sender");
    }
    if (!(file instanceof Blob)) {
      throw new ValidationError("file required");
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await platformEmailBrandingService.uploadImage(kind, buf);
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
