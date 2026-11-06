import { NextRequest, NextResponse } from "next/server";
import { requirePlatformRead } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { platformOutreachService } from "@/services/platform-outreach.service";

export async function GET(request: NextRequest) {
  try {
    await requirePlatformRead();
    const sp = request.nextUrl.searchParams;
    const hasWebsiteRaw = sp.get("hasWebsite");
    const contacts = await platformOutreachService.searchContacts({
      q: sp.get("q") || undefined,
      country: sp.get("country") || undefined,
      hasWebsite:
        hasWebsiteRaw === "true"
          ? true
          : hasWebsiteRaw === "false"
            ? false
            : null,
      limit: Number(sp.get("limit") || 50),
    });
    return NextResponse.json(apiSuccess({ contacts }));
  } catch (error) {
    return handleApiError(error);
  }
}
