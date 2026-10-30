import type { Metadata } from "next";
import { Calendar, Mail, MessageSquare, Phone } from "lucide-react";
import { ContactForm } from "@/components/marketing/contact-form";
import { siteConfig } from "@/content/site";
import { buildPageMetadata } from "@/lib/marketing/page-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact Delvix Studio | Book a Call or Send a Message",
  description: "Tell us what you need. We reply within [1 business day] with next steps or a time for a call.",
  path: "/contact",
});

const channels = [
  {
    icon: Calendar,
    title: "Book a free 30-minute call",
    value: "Pick a time that suits you",
    href: siteConfig.contact.bookingUrl,
  },
  {
    icon: MessageSquare,
    title: "WhatsApp",
    value: "Quickest for short questions",
    href: siteConfig.contact.whatsapp,
  },
  {
    icon: Mail,
    title: "Email",
    value: siteConfig.contact.email,
    href: `mailto:${siteConfig.contact.email}`,
  },
  {
    icon: Phone,
    title: "Phone",
    value: siteConfig.contact.phoneDisplay,
    href: `tel:${siteConfig.contact.phone}`,
  },
];

export default function ContactPage() {
  return (
    <section className="mkt-section mkt-section--dark mkt-grid-bg">
      <div className="mkt-wrap">
        <div className="grid gap-14 lg:grid-cols-2">
          <div className="space-y-6">
            <p className="mkt-eyebrow">Contact</p>
            <h1 className="text-4xl font-extrabold text-balance leading-tight sm:text-5xl lg:text-6xl">
              Tell us what you need.
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Send a few lines about your project. We reply within [1 business day] with next steps or a time for a call.
            </p>

            <div className="mt-8 space-y-3">
              {channels.map((channel) => (
                <a
                  key={channel.title}
                  href={channel.href}
                  className="mkt-card flex items-center gap-4 transition-all hover:scale-[1.02] hover:border-[var(--mkt-accent)]"
                  target={channel.href.startsWith("http") ? "_blank" : undefined}
                  rel={channel.href.startsWith("http") ? "noopener noreferrer" : undefined}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--mkt-bg-subtle)]">
                    <channel.icon className="h-5 w-5 text-[var(--mkt-accent)]" />
                  </div>
                  <div>
                    <p className="font-semibold">{channel.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {channel.value}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="mkt-card mkt-card--light">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}
