import { NextRequest, NextResponse } from "next/server";
import {
  requireOrgPermission,
  requireOrganizationContext,
  requirePlatformRead,
} from "@/lib/auth/api-auth";
import { handleApiError } from "@/lib/api/error-handler";
import { invoiceService } from "@/services/billing/invoice.service";
import prisma from "@/lib/db/prisma";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return new NextResponse("Not found", { status: 404 });
    }

    // Platform admins or the owning org
    try {
      await requirePlatformRead();
    } catch {
      await requireOrgPermission("billing.manage");
      const user = await requireOrganizationContext();
      if (user.organizationId !== invoice.organizationId) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    const html = await invoiceService.renderInvoiceHtml(id);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${invoice.number}.html"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
