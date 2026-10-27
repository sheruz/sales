import Link from "next/link";
import type { Metadata } from "next";
import { siteConfig } from "@/content/site";

export const metadata: Metadata = {
  title: "Cookies",
  description: "Cookies and similar technologies used on delvixstudio.com.",
  alternates: { canonical: `${siteConfig.url}/cookies` },
};

export default function CookiesPage() {
  return (
    <section className="mkt-section mkt-section--dark">
      <article className="mkt-wrap max-w-3xl space-y-6 text-sm leading-relaxed">
        <div className="space-y-3">
          <p className="mkt-eyebrow">Legal</p>
          <h1 className="text-4xl font-extrabold">Cookies</h1>
        </div>
        <p>
          Essential cookies keep you signed in to the Delvix product and protect
          forms from abuse. They are required for the app to work.
        </p>
        <p>
          If a Meta Pixel is enabled in Super Admin settings, marketing pages may
          set advertising cookies for measurement (PageView, Lead, Schedule).
          The Pixel is not loaded inside /dashboard or /platform.
        </p>
        <p>
          You can clear or block cookies in your browser. Blocking essential
          cookies may prevent login.
        </p>
        <p>
          More detail:{" "}
          <Link href="/privacy" className="mkt-link">
            Privacy Policy
          </Link>
          .
        </p>
      </article>
    </section>
  );
}
