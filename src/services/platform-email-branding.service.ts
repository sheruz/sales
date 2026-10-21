/**
 * Super Admin platform email branding (system → tenant emails).
 * Same EmailBranding shape as org branding; stored on PaymentSettings.
 */

import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import prisma from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { ValidationError } from "@/lib/api/response";
import {
  asEmailBranding,
  brandingPublicUrl,
  type EmailBranding,
} from "@/lib/email/branding";
import { brandingRootDir } from "@/lib/email/branding-fs";
import { PLATFORM_BRANDING_ORG_KEY } from "@/lib/email/render-platform-transactional";
import { paymentConfigService } from "@/services/billing/payment-config.service";
import { organizationService } from "@/services/organization.service";

function brandDir() {
  return join(brandingRootDir(), PLATFORM_BRANDING_ORG_KEY);
}

export class PlatformEmailBrandingService {
  async get(): Promise<EmailBranding> {
    await paymentConfigService.ensureDefaults();
    const row = await prisma.paymentSettings.findUnique({
      where: { id: "default" },
      select: { emailBranding: true },
    });
    return asEmailBranding({ emailBranding: row?.emailBranding ?? {} });
  }

  async set(
    patch: Partial<EmailBranding>,
    actorUserId: string
  ): Promise<EmailBranding> {
    const current = await this.get();
    const next: EmailBranding = {
      ...current,
      ...patch,
      logoPath: patch.logoPath !== undefined ? patch.logoPath : current.logoPath,
      senderPhotoPath:
        patch.senderPhotoPath !== undefined
          ? patch.senderPhotoPath
          : current.senderPhotoPath,
    };

    await prisma.paymentSettings.update({
      where: { id: "default" },
      data: { emailBranding: next as unknown as Prisma.InputJsonValue },
    });

    await organizationService.writePlatformAudit({
      actorUserId,
      action: "platform.email_branding_updated",
      targetType: "payment_settings",
      targetId: "default",
      after: {
        legalCompanyName: next.legalCompanyName,
        senderName: next.senderName,
        websiteUrl: next.websiteUrl,
      },
    });

    return next;
  }

  async uploadImage(
    kind: "logo" | "sender",
    file: Buffer
  ): Promise<{ path: string; url: string }> {
    if (file.length > 2 * 1024 * 1024) {
      throw new ValidationError("Image must be under 2MB");
    }
    let png: Buffer;
    try {
      png = await sharp(file)
        .resize(96, 96, { fit: "cover" })
        .png()
        .toBuffer();
    } catch {
      throw new ValidationError("Invalid image — upload a PNG or JPEG");
    }

    await mkdir(brandDir(), { recursive: true });
    const filename = kind === "logo" ? "logo.png" : "sender.png";
    await writeFile(join(brandDir(), filename), png);
    const relative = `branding/${PLATFORM_BRANDING_ORG_KEY}/${filename}`;
    const url = brandingPublicUrl(PLATFORM_BRANDING_ORG_KEY, filename);

    await paymentConfigService.ensureDefaults();
    const current = await this.get();
    await prisma.paymentSettings.update({
      where: { id: "default" },
      data: {
        emailBranding: {
          ...current,
          ...(kind === "logo"
            ? { logoPath: relative }
            : { senderPhotoPath: relative }),
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return { path: relative, url };
  }
}

export const platformEmailBrandingService = new PlatformEmailBrandingService();
