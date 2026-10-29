"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SiteLogo } from "@/components/marketing/site-logo";
import { NavIcon } from "@/components/marketing/nav-icons";
import {
  headerCtas,
  mainNav,
  type NavHighlight,
  type NavSection,
  type NavTop,
} from "@/content/navigation";

export function MegaPanel({
  id,
  label,
  sections,
  highlight,
  onNavigate,
}: {
  id: string;
  label: string;
  sections: NavSection[];
  highlight?: NavHighlight;
  onNavigate: () => void;
}) {
  const single = sections.length === 1;
  const cols = single ? 1 : Math.min(sections.length, 3);

  return (
    <div id={id} className="mkt-mega" role="region" aria-label={`${label} menu`}>
      <div className="mkt-mega__inner mkt-wrap">
        <div
          className="mkt-mega__body"
          data-has-highlight={highlight ? "true" : "false"}
        >
          <div
            className="mkt-mega__cols"
            style={{ "--mkt-mega-cols": cols } as React.CSSProperties}
          >
            {sections.map((section) => (
              <section
                key={section.heading}
                className="mkt-mega__section"
                aria-label={section.heading}
              >
                <h3 className="mkt-mega__heading">{section.heading}</h3>
                <ul
                  className="mkt-mega__links"
                  data-wide={
                    single && section.links.length > 5 ? "true" : undefined
                  }
                >
                  {section.links.map((link) => (
                    <li key={link.href + link.title}>
                      <Link
                        href={link.href}
                        className="mkt-mega__link"
                        onClick={onNavigate}
                      >
                        <span className="mkt-mega__icon">
                          <NavIcon name={link.icon} />
                        </span>
                        <span className="mkt-mega__text">
                          <span className="mkt-mega__title">{link.title}</span>
                          <span className="mkt-mega__desc">
                            {link.description}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {highlight ? (
            <aside className="mkt-mega__highlight" aria-label="Featured">
              <div className="mkt-mega__media">
                {highlight.imageSrc ? (
                  <Image
                    src={highlight.imageSrc}
                    alt={highlight.imageAlt ?? highlight.title}
                    fill
                    className="object-cover object-top"
                    sizes="280px"
                    unoptimized
                  />
                ) : (
                  <span>{highlight.title}</span>
                )}
              </div>
              <p className="mkt-mega__hl-title">{highlight.title}</p>
              <p className="mkt-mega__hl-body">{highlight.body}</p>
              <Link
                href={highlight.href}
                className="mkt-btn mkt-btn--primary mkt-mega__hl-cta"
                onClick={onNavigate}
              >
                {highlight.ctaLabel}
              </Link>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function MobileMenu({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !rootRef.current) return;
    const focusables = rootRef.current.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled])"
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      id="mkt-mobile-nav"
      ref={rootRef}
      className="mkt-mobile"
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
      onKeyDown={onKeyDown}
    >
      <div className="mkt-mobile__bar">
        <SiteLogo />
        <button
          type="button"
          ref={closeRef}
          className="mkt-btn mkt-btn--secondary mkt-menu-btn"
          aria-label="Close menu"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
          <span>Close</span>
        </button>
      </div>

      <nav className="mkt-mobile__scroll" aria-label="Mobile">
        <ul className="mkt-mobile__list">
          {mainNav.map((top) => (
            <li key={top.id} className="mkt-mobile__item">
              {top.sections?.length ? (
                <MobileAccordion
                  top={top}
                  open={expanded === top.id}
                  onToggle={() =>
                    setExpanded((cur) => (cur === top.id ? null : top.id))
                  }
                  onNavigate={onNavigate}
                />
              ) : (
                <Link
                  href={top.href ?? "/"}
                  className="mkt-mobile__row"
                  onClick={onNavigate}
                >
                  <span className="mkt-mobile__row-icon">
                    <NavIcon name={top.icon} size={20} />
                  </span>
                  {top.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="mkt-mobile__footer">
        <Link
          href={headerCtas.secondary.href}
          className="mkt-btn mkt-btn--secondary"
          onClick={onNavigate}
        >
          {headerCtas.secondary.label}
        </Link>
        <Link
          href={headerCtas.primary.href}
          className="mkt-btn mkt-btn--primary"
          data-mkt-schedule
          onClick={onNavigate}
        >
          {headerCtas.primary.label}
        </Link>
      </div>
    </div>
  );
}

function MobileAccordion({
  top,
  open,
  onToggle,
  onNavigate,
}: {
  top: NavTop;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const panelId = `mkt-mobile-${top.id}`;
  return (
    <>
      <button
        type="button"
        className="mkt-mobile__row mkt-mobile__row--btn"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="mkt-mobile__row-icon">
          <NavIcon name={top.icon} size={20} />
        </span>
        <span className="mkt-mobile__row-label">{top.label}</span>
        <ChevronDown
          className="mkt-mobile__chev"
          size={18}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div id={panelId} className="mkt-mobile__panel">
          {top.sections?.map((section) => (
            <div key={section.heading} className="mkt-mobile__section">
              <p className="mkt-mobile__heading">{section.heading}</p>
              <ul>
                {section.links.map((link) => (
                  <li key={link.href + link.title}>
                    <Link
                      href={link.href}
                      className="mkt-mega__link"
                      onClick={onNavigate}
                    >
                      <span className="mkt-mega__icon">
                        <NavIcon name={link.icon} />
                      </span>
                      <span className="mkt-mega__text">
                        <span className="mkt-mega__title">{link.title}</span>
                        <span className="mkt-mega__desc">
                          {link.description}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {top.highlight ? (
            <Link
              href={top.highlight.href}
              className="mkt-mobile__highlight"
              onClick={onNavigate}
            >
              <span className="mkt-mobile__hl-title">
                {top.highlight.title}
              </span>
              <span className="mkt-mobile__hl-cta">
                {top.highlight.ctaLabel} →
              </span>
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
