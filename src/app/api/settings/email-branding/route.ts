import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireAnyOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { emailBrandingService } from "@/services/email-branding.service";
import {
  brandingFileUrlFromPath,
  resolveSenderBranding,
} from "@/lib/email/branding";
import { renderOutboundEmail } from "@/lib/email/render-outbound";
import { unsubscribeUrl } from "@/services/unsubscribe.service";

const patchSchema = z.object({
  senderName: z.string().max(120).optional(),
  senderTitle: z.string().max(120).optional(),
  websiteUrl: z.string().url().max(500).optional().or(z.literal("")),
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
    const user = await requireAnyOrgPermission([
      "integrations.manage",
      "business_brain.manage",
      "campaigns.manage",
    ]);
    await requireOrganizationContext();
    const branding = await emailBrandingService.get(user.organizationId);
    const bust = Date.now();
    const sender = resolveSenderBranding({
      organizationId: user.organizationId,
      branding,
    });
    // Bust CDN/browser cache after re-upload so preview shows new logo
    if (sender.logoUrl) {
      sender.logoUrl = `${sender.logoUrl}${sender.logoUrl.includes("?") ? "&" : "?"}v=${bust}`;
    }
    if (sender.senderPhotoUrl) {
      sender.senderPhotoUrl = `${sender.senderPhotoUrl}${sender.senderPhotoUrl.includes("?") ? "&" : "?"}v=${bust}`;
    }
    const preview = renderOutboundEmail({
      style: "BRANDED",
      subject: "Website Audit Guidelines",
      pitch: {
        greeting: "Hi there,",
        introHtml:
          "<p>I was reviewing acme.example and noticed a few things worth a quick look.</p>",
        findingTitle: "Mobile visitors may leave before converting",
        findingText:
          "Slow mobile load times usually mean fewer inquiries from people browsing on the go.",
        bodyHtml:
          "<p>We build practical web apps and booking flows for teams like yours — happy to share a short example.</p>",
        preheader: "A quick note on your site's mobile experience",
      },
      contact: { firstName: null, email: "info@acme.example" },
      company: { name: "Acme Realty", domain: "acme.example" },
      sender,
      unsubscribeUrl: unsubscribeUrl(
        user.organizationId,
        "preview@example.com"
      ),
    });
    return NextResponse.json(
      apiSuccess({
        branding,
        previewHtml: preview.html,
        logoUrl: brandingFileUrlFromPath(
          user.organizationId,
          branding.logoPath,
          bust
        ),
        senderPhotoUrl: brandingFileUrlFromPath(
          user.organizationId,
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
    const user = await requireAnyOrgPermission([
      "integrations.manage",
      "business_brain.manage",
      "campaigns.manage",
    ]);
    await requireOrganizationContext();
    const body = patchSchema.parse(await request.json());
    const branding = await emailBrandingService.set(user.organizationId, body);
    return NextResponse.json(apiSuccess({ branding }));
  } catch (error) {
    return handleApiError(error);
  }
}
