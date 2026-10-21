import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireSuperAdmin,
  requireSuperAdminWrite,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { platformEmailBrandingService } from "@/services/platform-email-branding.service";
import {
  PLATFORM_BRANDING_ORG_KEY,
  renderPlatformTransactionalEmail,
} from "@/lib/email/render-platform-transactional";
import { brandingFileUrlFromPath } from "@/lib/email/branding";

const patchSchema = z.object({
  senderName: z.string().max(120).optional(),
  senderTitle: z.string().max(120).optional(),
  websiteUrl: z.string().max(500).optional(),
  websiteLabel: z.string().max(120).optional(),
  whatsappE164: z.string().max(32).optional(),
  bookingUrl: z.string().max(500).optional(),
  ctaLabel: z.string().max(80).optional(),
  footerServices: z.string().max(300).optional(),
  availabilityLine: z.string().max(200).optional(),
  legalCompanyName: z.string().max(200).optional(),
  businessAddress: z.string().max(500).optional(),
});

export async function GET() {
  try {
    await requireSuperAdmin();
    const branding = await platformEmailBrandingService.get();
    const bust = Date.now();
    const preview = renderPlatformTransactionalEmail({
      branding,
      subject: "Welcome — your workspace is active",
      body: "Your payment was received and your workspace is now active. You can open billing anytime from Settings.",
      orgName: "Acme Demo Co",
      ctaLabel: "Open billing",
      cacheBust: bust,
    });
    return NextResponse.json(
      apiSuccess({
        branding,
        previewHtml: preview.html,
        logoUrl: brandingFileUrlFromPath(
          PLATFORM_BRANDING_ORG_KEY,
          branding.logoPath,
          bust
        ),
        senderPhotoUrl: brandingFileUrlFromPath(
          PLATFORM_BRANDING_ORG_KEY,
          branding.senderPhotoPath,
          bust
        ),
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireSuperAdminWrite();
    const body = patchSchema.parse(await request.json());
    const branding = await platformEmailBrandingService.set(body, user.id);
    return NextResponse.json(apiSuccess({ branding }));
  } catch (error) {
    return handleApiError(error);
  }
}
