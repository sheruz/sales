/**
 * B3.2: Resolve and sync tenant billing contact → Paddle/Stripe customer.
 * Rule: one provider customer per organization per environment; email = billingEmail.
 */

import prisma from "@/lib/db/prisma";
import { ValidationError } from "@/lib/api/response";
import { paddleProvider } from "@/services/billing/paddle.provider";
import { isPaddleConfigured } from "@/services/billing/paddle-client";
import { organizationService } from "@/services/organization.service";

export type BillingContactPatch = {
  billingEmail?: string | null;
  billingContactName?: string | null;
  billingAddress?: string | null;
  billingCountry?: string | null;
  billingTaxId?: string | null;
};

export class BillingContactService {
  async resolveBillingEmail(organizationId: string): Promise<string> {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { billingEmail: true },
    });
    if (org.billingEmail?.trim()) return org.billingEmail.trim().toLowerCase();

    const admin = await prisma.organizationUser.findFirst({
      where: {
        organizationId,
        isPrimaryAdmin: true,
        status: "ACTIVE",
      },
      include: { user: { select: { email: true } } },
    });
    const email = admin?.user.email?.trim().toLowerCase();
    if (!email) {
      throw new ValidationError(
        "Set a billing email on Plan & Billing before checkout"
      );
    }
    // Persist so future checkouts / Paddle customer stay consistent
    await prisma.organization.update({
      where: { id: organizationId },
      data: { billingEmail: email },
    });
    return email;
  }

  async resolveContactName(organizationId: string): Promise<string> {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { billingContactName: true, name: true },
    });
    if (org.billingContactName?.trim()) return org.billingContactName.trim();
    const admin = await prisma.organizationUser.findFirst({
      where: { organizationId, isPrimaryAdmin: true },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });
    const fromOwner = [admin?.user.firstName, admin?.user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    return fromOwner || org.name;
  }

  async getBillingDetails(organizationId: string) {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        billingEmail: true,
        billingContactName: true,
        billingAddress: true,
        billingCountry: true,
        billingTaxId: true,
        paddleCustomerId: true,
        paddleCustomerEnv: true,
        stripeCustomerId: true,
        stripeCustomerEnv: true,
        name: true,
      },
    });
    let email = org.billingEmail;
    if (!email) {
      try {
        email = await this.resolveBillingEmail(organizationId);
      } catch {
        email = null;
      }
    }
    return { ...org, billingEmail: email };
  }

  async updateBillingDetails(
    organizationId: string,
    patch: BillingContactPatch,
    actorUserId?: string | null
  ) {
    const data: Record<string, string | null> = {};
    if (patch.billingEmail !== undefined) {
      const v = patch.billingEmail?.trim().toLowerCase() || null;
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        throw new ValidationError("Invalid billing email");
      }
      data.billingEmail = v;
    }
    if (patch.billingContactName !== undefined) {
      data.billingContactName = patch.billingContactName?.trim() || null;
    }
    if (patch.billingAddress !== undefined) {
      data.billingAddress = patch.billingAddress?.trim() || null;
    }
    if (patch.billingCountry !== undefined) {
      data.billingCountry = patch.billingCountry?.trim().toUpperCase() || null;
    }
    if (patch.billingTaxId !== undefined) {
      data.billingTaxId = patch.billingTaxId?.trim() || null;
    }
    if (!Object.keys(data).length) {
      return this.getBillingDetails(organizationId);
    }

    const before = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        billingEmail: true,
        billingContactName: true,
        billingAddress: true,
        billingCountry: true,
        billingTaxId: true,
        paddleCustomerId: true,
        name: true,
      },
    });

    await prisma.organization.update({
      where: { id: organizationId },
      data,
    });

    await organizationService.writePlatformAudit({
      action: "billing.contact_updated",
      targetType: "organization",
      organizationId,
      actorUserId: actorUserId ?? undefined,
      before,
      after: data,
    });

    if (await isPaddleConfigured()) {
      const email =
        (data.billingEmail as string | null | undefined) ??
        before.billingEmail ??
        (await this.resolveBillingEmail(organizationId));
      const name =
        (data.billingContactName as string | null | undefined) ??
        before.billingContactName ??
        (await this.resolveContactName(organizationId));
      await paddleProvider.syncCustomerDetails({
        organizationId,
        email,
        name,
        address: data.billingAddress !== undefined
          ? (data.billingAddress as string | null)
          : before.billingAddress,
        country: data.billingCountry !== undefined
          ? (data.billingCountry as string | null)
          : before.billingCountry,
        taxId: data.billingTaxId !== undefined
          ? (data.billingTaxId as string | null)
          : before.billingTaxId,
      });
    }

    return this.getBillingDetails(organizationId);
  }
}

export const billingContactService = new BillingContactService();
