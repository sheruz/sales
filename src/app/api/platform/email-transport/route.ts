import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireSuperAdmin,
  requireSuperAdminWrite,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { platformEmailTransportService } from "@/services/billing/platform-email-transport.service";

const optionalEmail = z
  .union([z.string().email(), z.literal(""), z.null()])
  .optional();

const patchSchema = z.object({
  provider: z.enum(["RESEND", "SMTP"]).optional(),
  fromEmail: optionalEmail,
  fromName: z.string().max(120).nullable().optional(),
  replyTo: optionalEmail,
  domain: z.string().max(253).nullable().optional(),
  resendApiKey: z.string().max(500).nullable().optional(),
  checkDns: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireSuperAdmin();
    const transport = await platformEmailTransportService.getPublic();
    let dns = null;
    if (transport.domain) {
      try {
        dns = await platformEmailTransportService.checkDns(transport.domain);
      } catch {
        dns = null;
      }
    }
    return NextResponse.json(apiSuccess({ transport, dns }));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireSuperAdminWrite();
    const body = patchSchema.parse(await request.json());
    const transport = await platformEmailTransportService.update(
      {
        provider: body.provider,
        fromEmail:
          body.fromEmail === "" ? null : (body.fromEmail as string | null),
        fromName: body.fromName,
        replyTo: body.replyTo === "" ? null : (body.replyTo as string | null),
        domain: body.domain,
        resendApiKey: body.resendApiKey,
      },
      user.id
    );
    let dns = null;
    if (body.checkDns || transport.domain) {
      try {
        dns = await platformEmailTransportService.checkDns(transport.domain);
      } catch {
        dns = null;
      }
    }
    return NextResponse.json(apiSuccess({ transport, dns }));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();
    const body = z
      .object({ domain: z.string().min(1).max(253).optional() })
      .parse(await request.json().catch(() => ({})));
    const dns = await platformEmailTransportService.checkDns(body.domain);
    return NextResponse.json(apiSuccess({ dns }));
  } catch (error) {
    return handleApiError(error);
  }
}
