import Link from "next/link";
import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/contact-form";
import { siteConfig } from "@/content/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Book a call, WhatsApp, or send a project brief to Delvix Studio.",
  alternates: { canonical: `${siteConfig.url}/contact` },
};

export default function ContactPage() {
  const { email, phone, phoneDisplay, whatsapp, bookingUrl } = siteConfig.contact;

  return (
    <section className="mkt-section mkt-section--dark">
      <div className="mkt-wrap grid gap-12 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="mkt-eyebrow">Contact</p>
            <h1 className="text-4xl font-extrabold sm:text-5xl">
              Tell us what you&apos;re running on
            </h1>
            <p className="mkt-muted text-lg">
              Prefer a call, chat or a short written brief — all fine.
            </p>
          </div>
          <ul className="space-y-3 text-sm">
            <li>
              <a className="mkt-link" href={`mailto:${email}`}>
                {email}
              </a>
            </li>
            <li>
              <a className="mkt-link" href={`tel:${phone}`}>
                {phoneDisplay}
              </a>
            </li>
            <li>
              <a
                className="mkt-link"
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            </li>
          </ul>
          <Link
            href={bookingUrl}
            className="mkt-btn mkt-btn--primary inline-flex"
            data-mkt-schedule
          >
            Book a free call
          </Link>
        </div>
        <div>
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
