"use client";

import Link from "next/link";
import { useState } from "react";
import { siteConfig } from "@/content/site";

const NAV = [
  { href: "/services", label: "Services" },
  { href: "/solutions", label: "Solutions" },
  { href: "/industries", label: "Industries" },
  { href: "/work", label: "Work" },
  { href: "/process", label: "Process" },
  { href: "/autopilot", label: "Autopilot" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mkt-topbar">
        <div className="mkt-wrap flex flex-wrap items-center justify-between gap-2 py-2">
          <a href={`mailto:${siteConfig.contact.email}`}>
            {siteConfig.contact.email}
          </a>
          <div className="flex flex-wrap gap-4">
            <a
              href={siteConfig.contact.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
            <a href={`tel:${siteConfig.contact.phone}`}>
              {siteConfig.contact.phoneDisplay}
            </a>
          </div>
        </div>
      </div>
      <header className="mkt-header">
        <div className="mkt-wrap flex items-center justify-between gap-4 py-3">
          <Link href="/" className="text-lg font-bold tracking-tight text-[var(--mkt-ink)]">
            Delvix Studio
          </Link>
          <nav className="mkt-nav hidden items-center gap-4 xl:gap-5 lg:flex" aria-label="Primary">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <Link href="/contact" className="mkt-btn mkt-btn--secondary">
              Get a quote
            </Link>
            <Link
              href={siteConfig.contact.bookingUrl}
              className="mkt-btn mkt-btn--primary"
              data-mkt-schedule
            >
              Book a free call
            </Link>
          </div>
          <button
            type="button"
            className="mkt-btn mkt-btn--secondary min-w-[2.75rem] lg:!hidden"
            aria-expanded={open}
            aria-controls="mkt-mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
        </div>
        {open ? (
          <div
            id="mkt-mobile-nav"
            className="border-t border-[var(--mkt-line)] lg:hidden"
          >
            <nav className="mkt-wrap flex flex-col gap-3 py-4" aria-label="Mobile">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="text-[var(--mkt-ink)]"
                >
                  {item.label}
                </Link>
              ))}
              <Link href="/contact" className="mkt-btn mkt-btn--secondary" onClick={() => setOpen(false)}>
                Get a quote
              </Link>
              <Link
                href={siteConfig.contact.bookingUrl}
                className="mkt-btn mkt-btn--primary"
                data-mkt-schedule
                onClick={() => setOpen(false)}
              >
                Book a free call
              </Link>
            </nav>
          </div>
        ) : null}
      </header>
    </>
  );
}
