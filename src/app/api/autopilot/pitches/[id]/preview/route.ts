import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireAnyOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import prisma from "@/lib/db/prisma";
import { PitchStatus } from "@prisma/client";
import { emailBrandingService } from "@/services/email-branding.service";
import { renderOutboundEmail } from "@/lib/email/render-outbound";
import { unsubscribeUrl } from "@/services/unsubscribe.service";
import { inboxService } from "@/services/inbox.service";
import { mailboxPoolService } from "@/services/mailbox-pool.service";

const schema = z.object({
  style: z.enum(["BRANDED", "PLAIN"]).default("BRANDED"),
  sendTest: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAnyOrgPermission([
      "integrations.manage",
      "campaigns.manage",
      "business_brain.manage",
    ]);
    await requireOrganizationContext();
    const { id } = await ctx.params;
    const body = schema.parse(await request.json().catch(() => ({})));

    const pitch = await prisma.pitch.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        contact: true,
        company: true,
      },
    });
    if (!pitch) throw new ValidationError("Pitch not found");
    if (
      pitch.status !== PitchStatus.DRAFT &&
      pitch.status !== PitchStatus.APPROVED
    ) {
      throw new ValidationError("Pitch must be DRAFT or APPROVED to preview");
    }

    const sender = await emailBrandingService.resolveForSend(
      user.organizationId
    );
    const unsub = unsubscribeUrl(
      user.organizationId,
      pitch.contact.email || "preview@example.com"
    );
    const subject = `${pitch.company.name} — quick idea`;
    const rendered = renderOutboundEmail({
      style: body.style,
      subject,
      pitch: {
        greeting: pitch.greeting,
        introHtml: pitch.introHtml,
        findingTitle: pitch.findingTitle,
        findingText: pitch.findingText,
        bodyHtml: pitch.bodyHtml,
        preheader: pitch.preheader,
        personalizedFirstLine: pitch.personalizedFirstLine,
        shortPitch: pitch.shortPitch,
        topIssue: pitch.topIssue,
      },
      contact: {
        firstName: pitch.contact.firstName,
        email: pitch.contact.email,
      },
      company: {
        name: pitch.company.name,
        domain: pitch.company.domain,
      },
      sender,
      unsubscribeUrl: unsub,
    });

    if (body.sendTest) {
      const mailbox = await mailboxPoolService.pickMailbox(user.organizationId);
      if (!mailbox) {
        throw new ValidationError(
          "No active outbound mailbox — add one in Autopilot → Outbound"
        );
      }
      const to = mailbox.emailAccount.email;
      await inboxService.sendOutreach({
        organizationId: user.organizationId,
        userId: mailbox.emailAccount.userId || user.id,
        emailAccountId: mailbox.emailAccountId,
        toEmail: to,
        subject: `[TEST ${body.style}] ${rendered.subject}`,
        body: rendered.text,
        bodyHtml: rendered.html,
        companyId: pitch.companyId,
        contactId: pitch.contactId,
        opportunityId: pitch.opportunityId,
        idempotencyKey: `pitch-test:${pitch.id}:${body.style}:${Date.now()}`,
      });
      return NextResponse.json(
        apiSuccess({
          style: body.style,
          html: rendered.html,
          text: rendered.text,
          subject: rendered.subject,
          testSentTo: to,
        })
      );
    }

    return NextResponse.json(
      apiSuccess({
        style: body.style,
        html: rendered.html,
        text: rendered.text,
        subject: rendered.subject,
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
