import { NextRequest, NextResponse } from "next/server";
import { InvoiceStatus } from "@prisma/client";
import {
  requirePlatformRead,
  requireSuperAdminWrite,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { invoiceService } from "@/services/billing/invoice.service";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    await requirePlatformRead();
    const sp = request.nextUrl.searchParams;
    const status = sp.get("status") as InvoiceStatus | null;
    const invoices = await invoiceService.list({
      organizationId: sp.get("organizationId") || undefined,
      status: status || undefined,
      provider: sp.get("provider") || undefined,
      take: 200,
    });
    return NextResponse.json(apiSuccess({ invoices }));
  } catch (error) {
    return handleApiError(error);
  }
}

const markPaidSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.string().min(1),
  reference: z.string().optional(),
  notes: z.string().optional(),
  reason: z.string().min(1),
  activateNow: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperAdminWrite();
    const body = await request.json();
    if (body.action === "mark_paid") {
      const parsed = markPaidSchema.parse(body);
      const result = await invoiceService.markPaid({
        ...parsed,
        actorUserId: actor.id,
      });
      return NextResponse.json(apiSuccess(result));
    }
    if (body.action === "void") {
      const parsed = z
        .object({
          invoiceId: z.string().uuid(),
          reason: z.string().min(1),
        })
        .parse(body);
      const result = await invoiceService.voidInvoice({
        ...parsed,
        actorUserId: actor.id,
      });
      return NextResponse.json(apiSuccess(result));
    }
    if (body.action === "set_payment_url") {
      const parsed = z
        .object({
          invoiceId: z.string().uuid(),
          paymentUrl: z.string().url(),
          reason: z.string().min(1),
        })
        .parse(body);
      const result = await invoiceService.setPaymentUrl({
        ...parsed,
        actorUserId: actor.id,
      });
      return NextResponse.json(apiSuccess(result));
    }
    return NextResponse.json(apiSuccess({ ok: false }));
  } catch (error) {
    return handleApiError(error);
  }
}
