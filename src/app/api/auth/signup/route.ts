import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { organizationService } from "@/services/organization.service";
import { entitlementService } from "@/services/entitlement.service";
import { billingService } from "@/services/billing.service";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { apiSuccess, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import prisma from "@/lib/db/prisma";

const signupSchema = z.object({
  organizationName: z.string().min(2).max(200),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  planId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = signupSchema.parse(await request.json());
    const email = body.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ValidationError("Email already registered");
    }

    const org = await organizationService.createOrganization({
      name: body.organizationName,
      admin: {
        email,
        password: body.password,
        firstName: body.firstName,
        lastName: body.lastName,
      },
    });

    const admin = await prisma.user.findUnique({ where: { email } });
    if (!admin) throw new ValidationError("Failed to create admin user");

    let checkoutUrl: string | null = null;
    if (body.planId) {
      const plan = await prisma.plan.findFirst({
        where: { id: body.planId, active: true },
      });
      if (plan && Number(plan.price) > 0) {
        try {
          const checkout = await billingService.createCheckoutSession({
            organizationId: org.id,
            planId: plan.id,
            userEmail: email,
          });
          checkoutUrl = checkout.url;
        } catch {
          // Stripe not configured or price missing — stay on Free entitlements
          await prisma.subscription.update({
            where: { organizationId: org.id },
            data: { planId: (await entitlementService.getDefaultPlan())!.id },
          });
        }
      } else if (plan) {
        await prisma.subscription.update({
          where: { organizationId: org.id },
          data: { planId: plan.id },
        });
      }
    }

    const usage = await entitlementService.getUsageSnapshot(org.id);

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      undefined;
    const userAgent = request.headers.get("user-agent") ?? undefined;
    const token = await createSession(admin.id, {
      ipAddress,
      userAgent,
      organizationId: org.id,
    });

    const response = NextResponse.json(
      apiSuccess({
        organizationId: org.id,
        plan: usage.subscription,
        entitlements: usage.entitlements,
        checkoutUrl,
      }),
      { status: 201 }
    );
    return setSessionCookie(response, token);
  } catch (error) {
    return handleApiError(error);
  }
}
