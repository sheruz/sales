import { NextResponse } from "next/server";
import { waitlistSchema } from "@/lib/marketing/schemas";
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
    const parsed = waitlistSchema.safeParse(json);
    if (!parsed.success) {
      const msg =
        parsed.error.issues[0]?.message || "Enter a valid work email.";
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }

    const data = parsed.data;
    if (data.website_url) {
      return NextResponse.json({ success: true });
    }

    const name = data.name?.trim() || data.email.split("@")[0] || "Waitlist";
    const brief = [
      `Autopilot early access request`,
      ``,
      `Email: ${data.email}`,
      `Name: ${name}`,
      `Source: delvixstudio.com Autopilot waitlist`,
    ].join("\n");

    const ros = await ingestInboundWithRetry({
      source: "autopilot_waitlist",
      name,
      email: data.email,
      brief,
      message: "Autopilot early access request",
    });

    if (!ros.ok) {
      console.error("[waitlist] inbound ingest failed after retry:", ros.error);
    }

    try {
      await sendMarketingNotify({
        subject: `[Autopilot waitlist] ${data.email}${ros.ok ? "" : " (CRM sync failed)"}`,
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
      console.error("[waitlist] Resend failed", err);
      return NextResponse.json(
        {
          success: false,
          error:
            "We could not join the list right now. Email info@delvixstudio.com with subject Autopilot early access.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "You're on the list — we'll be in touch soon.",
    });
  } catch (err) {
    console.error("[waitlist]", err);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
