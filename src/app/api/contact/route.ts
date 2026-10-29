import { NextResponse } from "next/server";
import { contactBriefSchema } from "@/lib/marketing/schemas";
import { clientIp, limitFormIp } from "@/lib/marketing/rate-limit";
import { sendMarketingNotify } from "@/lib/marketing/notify";
import { ingestInboundWithRetry } from "@/lib/marketing/ingest-inbound";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const limited = await limitFormIp(ip);
    if (!limited.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many requests. Try again in a few minutes.",
        },
        { status: 429 }
      );
    }

    const json = await request.json().catch(() => null);
    const parsed = contactBriefSchema.safeParse(json);
    if (!parsed.success) {
      const msg =
        parsed.error.issues[0]?.message ||
        "Please check the form and try again.";
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }

    const data = parsed.data;
    if (data.website_url) {
      return NextResponse.json({ success: true });
    }

    const brief = [
      `Project brief for Delvix Studio`,
      ``,
      `Name: ${data.name}`,
      `Email: ${data.email}`,
      `Company: ${data.company || "Not specified"}`,
      `Needs: ${data.needs.length ? data.needs.join(", ") : "Not specified"}`,
      `Budget: ${data.budget || "Not specified"}`,
      `Start: ${data.startTiming || "Not specified"}`,
      ``,
      `Details:`,
      data.message,
    ].join("\n");

    const ros = await ingestInboundWithRetry({
      source: "website",
      name: data.name,
      email: data.email,
      company: data.company || undefined,
      needs: data.needs,
      budget: data.budget || undefined,
      startTiming: data.startTiming || undefined,
      message: data.message,
      brief,
    });

    if (!ros.ok) {
      console.error("[contact] inbound ingest failed after retry:", ros.error);
    }

    try {
      await sendMarketingNotify({
        subject: `[Website brief] ${data.name}${ros.ok ? "" : " (CRM sync failed)"}`,
        replyTo: data.email,
        text: [
          ros.ok
            ? "Synced to Revenue OS."
            : `Revenue OS sync FAILED (visitor still got success):\n${ros.error}`,
          ``,
          brief,
          ``,
          `— Delvix Studio`,
        ].join("\n"),
      });
    } catch (err) {
      console.error("[contact] Resend failed", err);
      return NextResponse.json(
        {
          success: false,
          error:
            "We could not send your brief right now. Email info@delvixstudio.com directly.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Thanks — we will reply within one business day.",
    });
  } catch (err) {
    console.error("[contact]", err);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
