"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { SiteLogo } from "@/components/marketing/site-logo";
import { getMainNav, siteConfig, type NavItem } from "@/content/site";

export function SiteHeader() {
  const nav = getMainNav();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const panelId = useId();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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
          <SiteLogo />
          <nav
            className="mkt-nav hidden items-center gap-1 xl:gap-2 lg:flex"
            aria-label="Primary"
            onMouseLeave={() => setOpenMenu(null)}
          >
            {nav.map((item) => (
              <DesktopItem
                key={item.href + item.label}
                item={item}
                open={openMenu === item.label}
                onOpen={() => setOpenMenu(item.label)}
                onClose={() => setOpenMenu(null)}
                panelId={`${panelId}-${item.label}`}
              />
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <Link href="/pricing" className="mkt-btn mkt-btn--secondary">
              Get pricing
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
            aria-expanded={mobileOpen}
            aria-controls="mkt-mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            Menu
          </button>
        </div>

        {mobileOpen ? (
          <div
            id="mkt-mobile-nav"
            className="max-h-[75vh] overflow-y-auto border-t border-[var(--mkt-line)] lg:hidden"
          >
            <nav className="mkt-wrap flex flex-col gap-1 py-4" aria-label="Mobile">
              {nav.map((item) => (
                <MobileItem
                  key={item.href + item.label}
                  item={item}
                  open={mobileSection === item.label}
                  onToggle={() =>
                    setMobileSection((cur) =>
                      cur === item.label ? null : item.label
                    )
                  }
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
              <Link
                href="/contact"
                className="mkt-btn mkt-btn--secondary mt-3"
                onClick={() => setMobileOpen(false)}
              >
                Get a quote
              </Link>
              <Link
                href={siteConfig.contact.bookingUrl}
                className="mkt-btn mkt-btn--primary"
                data-mkt-schedule
                onClick={() => setMobileOpen(false)}
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

function DesktopItem({
  item,
  open,
  onOpen,
  onClose,
  panelId,
}: {
  item: NavItem;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  panelId: string;
}) {
  if (!item.children?.length) {
    return (
      <Link href={item.href} className="mkt-nav__top">
        {item.label}
      </Link>
    );
  }

  return (
    <div
      className="mkt-nav__item"
      onMouseEnter={onOpen}
      onFocus={onOpen}
    >
      <button
        type="button"
        className="mkt-nav__top mkt-nav__top--btn"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? onClose() : onOpen())}
      >
        {item.label}
        <span className="mkt-nav__chev" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div id={panelId} className="mkt-nav__panel" role="region" aria-label={item.label}>
          <div className="mkt-nav__panel-inner">
            <Link href={item.href} className="mkt-nav__panel-head" onClick={onClose}>
              Browse all {item.label.toLowerCase()} →
            </Link>
            <ul className="mkt-nav__grid">
              {item.children.map((child) => (
                <li key={child.href + child.label}>
                  <Link href={child.href} className="mkt-nav__card" onClick={onClose}>
                    <span className="mkt-nav__card-label">{child.label}</span>
                    {child.description ? (
                      <span className="mkt-nav__card-desc">{child.description}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MobileItem({
  item,
  open,
  onToggle,
  onNavigate,
}: {
  item: NavItem;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  if (!item.children?.length) {
    return (
      <Link
        href={item.href}
        className="rounded-lg px-2 py-2.5 text-[var(--mkt-ink)]"
        onClick={onNavigate}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div className="border-b border-[var(--mkt-line)] pb-2">
      <button
        type="button"
        className="flex w-full items-center justify-between px-2 py-2.5 text-left font-semibold text-[var(--mkt-ink)]"
        aria-expanded={open}
        onClick={onToggle}
      >
        {item.label}
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <ul className="space-y-1 pb-2 pl-3">
          {item.children.map((child) => (
            <li key={child.href + child.label}>
              <Link
                href={child.href}
                className="block rounded-md px-2 py-2 text-sm text-[var(--mkt-muted)]"
                onClick={onNavigate}
              >
                <span className="block font-medium text-[var(--mkt-ink)]">
                  {child.label}
                </span>
                {child.description ? (
                  <span className="mt-0.5 block text-xs leading-snug">
                    {child.description}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
