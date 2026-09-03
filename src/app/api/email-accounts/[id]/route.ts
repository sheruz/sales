import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { emailAccountService } from "@/services/email-account.service";
import { requirePermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requirePermission("integrations:manage");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const account = await emailAccountService.getById(user.organizationId, id);
    return NextResponse.json(
      apiSuccess(emailAccountService.sanitize(account))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  isDefault: z.boolean().optional(),
  dailyLimit: z.coerce.number().min(1).max(1000).optional(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requirePermission("integrations:manage");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    if (body.isDefault) {
      const account = await emailAccountService.setDefault(
        user.organizationId,
        user.id,
        id
      );
      return NextResponse.json(
        apiSuccess(emailAccountService.sanitize(account))
      );
    }
    const account = await emailAccountService.getById(user.organizationId, id);
    const updated = await prisma.emailAccount.update({
      where: { id: account.id },
      data: { dailyLimit: body.dailyLimit },
    });
    return NextResponse.json(
      apiSuccess(emailAccountService.sanitize(updated))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await requirePermission("integrations:manage");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const result = await emailAccountService.disconnect(
      user.organizationId,
      id
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
