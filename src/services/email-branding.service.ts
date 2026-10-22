import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import prisma from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { ValidationError } from "@/lib/api/response";
import {
  asEmailBranding,
  brandingPublicUrl,
  DEFAULT_EMAIL_BRANDING,
  type EmailBranding,
  resolveSenderBranding,
} from "@/lib/email/branding";
import { brandingRootDir } from "@/lib/email/branding-fs";
import { normalizeWhatsappE164 } from "@/lib/email/whatsapp";
import { outboundConfigService } from "@/services/outbound-config.service";

function orgBrandingDir(organizationId: string) {
  return join(brandingRootDir(), organizationId);
}

export class EmailBrandingService {
  async get(organizationId: string): Promise<EmailBranding> {
    const row = await prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { settings: true },
    });
    return asEmailBranding(row?.settings);
  }

  async set(
    organizationId: string,
    patch: Partial<EmailBranding>
  ): Promise<EmailBranding> {
    const current = await this.get(organizationId);
    const whatsapp =
      patch.whatsappE164 !== undefined
        ? normalizeWhatsappE164(patch.whatsappE164) ?? ""
        : current.whatsappE164;

    const next: EmailBranding = {
      ...current,
      ...patch,
      whatsappE164: whatsapp,
      logoPath: patch.logoPath !== undefined ? patch.logoPath : current.logoPath,
      senderPhotoPath:
        patch.senderPhotoPath !== undefined
          ? patch.senderPhotoPath
          : current.senderPhotoPath,
    };

    const row = await prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { settings: true },
    });
    const prev =
      row?.settings && typeof row.settings === "object" && !Array.isArray(row.settings)
        ? (row.settings as Record<string, unknown>)
        : {};

    await prisma.organizationSettings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        settings: { ...prev, emailBranding: next } as Prisma.InputJsonValue,
      },
      update: {
        settings: { ...prev, emailBranding: next } as Prisma.InputJsonValue,
      },
    });

    // Keep outbound compliance fields in sync
    if (next.legalCompanyName || next.businessAddress) {
      await outboundConfigService.setConfig(organizationId, {
        businessName: next.legalCompanyName || undefined,
        physicalAddress: next.businessAddress || undefined,
      });
    }

    return next;
  }

  async uploadImage(
    organizationId: string,
    kind: "logo" | "sender" | "mailbox_sender",
    file: Buffer,
    opts?: { mailboxId?: string }
  ): Promise<{ path: string; url: string }> {
    if (file.length > 2 * 1024 * 1024) {
      throw new ValidationError("Image must be under 2MB");
    }
    // Detect PNG (or convert anything sharp can read)
    let png: Buffer;
    try {
      png = await sharp(file)
        .resize(96, 96, { fit: "cover" })
        .png()
        .toBuffer();
    } catch {
      throw new ValidationError("Invalid image — upload a PNG or JPEG");
    }

    const dir = orgBrandingDir(organizationId);
    await mkdir(dir, { recursive: true });

    let filename: string;
    if (kind === "logo") filename = "logo.png";
    else if (kind === "mailbox_sender") {
      if (!opts?.mailboxId) {
        throw new ValidationError("mailboxId required for mailbox sender photo");
      }
      filename = `sender-${opts.mailboxId}.png`;
    } else {
      filename = "sender.png";
    }

    const abs = join(/*turbopackIgnore: true*/ dir, filename);
    await writeFile(abs, png);
    const relative = `branding/${organizationId}/${filename}`;
    const url = brandingPublicUrl(organizationId, filename);

    if (kind === "logo") {
      await this.set(organizationId, { logoPath: relative });
    } else if (kind === "sender") {
      await this.set(organizationId, { senderPhotoPath: relative });
    } else if (kind === "mailbox_sender" && opts?.mailboxId) {
      await prisma.outboundMailbox.updateMany({
        where: { id: opts.mailboxId, organizationId },
        data: { senderPhotoPath: relative },
      });
    }

    return { path: relative, url };
  }

  async resolveForSend(
    organizationId: string,
    mailboxId?: string | null
  ) {
    const [branding, org, outbound] = await Promise.all([
      this.get(organizationId),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      }),
      outboundConfigService.getConfig(organizationId).catch(() => null),
    ]);

    // Tenant-only names — never fall back to Delvix / platform owner branding.
    const orgName = org?.name?.trim() || "";
    const outboundBiz = outbound?.businessName?.trim() || "";
    const fallbackName =
      (orgName && !/^default\s+workspace$/i.test(orgName) ? orgName : "") ||
      outboundBiz ||
      "";

    let mailbox = null;
    if (mailboxId) {
      mailbox = await prisma.outboundMailbox.findFirst({
        where: { id: mailboxId, organizationId },
        select: {
          senderName: true,
          senderTitle: true,
          senderPhotoPath: true,
        },
      });
    }

    const legal =
      branding.legalCompanyName.trim() ||
      outboundBiz ||
      (orgName && !/^default\s+workspace$/i.test(orgName) ? orgName : "") ||
      "";

    const senderName =
      branding.senderName.trim() || outboundBiz || fallbackName;

    return resolveSenderBranding({
      organizationId,
      branding: {
        ...branding,
        legalCompanyName: legal,
        senderName,
        businessAddress:
          branding.businessAddress.trim() ||
          outbound?.physicalAddress?.trim() ||
          "",
      },
      mailbox,
      orgFallbackName: fallbackName,
    });
  }
}

export const emailBrandingService = new EmailBrandingService();
