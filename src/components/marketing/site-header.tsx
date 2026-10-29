"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ChevronDown, Menu } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { SiteLogo } from "@/components/marketing/site-logo";
import {
  headerCtas,
  mainNav,
  type NavTop,
} from "@/content/navigation";
import { siteConfig } from "@/content/site";

/** Icons + mega panel load only when a menu opens — keeps initial JS small for LCP. */
const MegaPanel = dynamic(
  () =>
    import("@/components/marketing/site-mega-menu").then((m) => m.MegaPanel),
  { ssr: false }
);
const MobileMenu = dynamic(
  () =>
    import("@/components/marketing/site-mega-menu").then((m) => m.MobileMenu),
  { ssr: false }
);

const HOVER_CLOSE_DELAY_MS = 140;

export function SiteHeader() {
  const baseId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const topRefs = useRef<Array<HTMLElement | null>>([]);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const closeMenu = useCallback(() => {
    clearCloseTimer();
    setOpenId(null);
    setPinned(false);
  }, [clearCloseTimer]);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  useEffect(() => {
    if (!openId) return;

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const index = mainNav.findIndex((t) => t.id === openId);
      closeMenu();
      topRefs.current[index]?.focus();
    }
    function onPointerDown(e: PointerEvent) {
      if (!headerRef.current?.contains(e.target as Node)) closeMenu();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openId, closeMenu]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    function onResize() {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [mobileOpen]);

  function openOnHover(id: string) {
    clearCloseTimer();
    if (pinned && openId && openId !== id) {
      setOpenId(id);
      setPinned(false);
      return;
    }
    if (!pinned) setOpenId(id);
  }

  function scheduleHoverClose() {
    if (pinned) return;
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      setOpenId(null);
    }, HOVER_CLOSE_DELAY_MS);
  }

  function toggleByClick(id: string) {
    clearCloseTimer();
    if (openId === id && pinned) {
      closeMenu();
    } else {
      setOpenId(id);
      setPinned(true);
    }
  }

  function onTopKeyDown(e: React.KeyboardEvent, index: number, top: NavTop) {
    const count = mainNav.length;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next =
        (index + (e.key === "ArrowRight" ? 1 : -1) + count) % count;
      const nextTop = mainNav[next];
      if (openId && nextTop.sections?.length) {
        setOpenId(nextTop.id);
        setPinned(true);
      } else if (openId) {
        closeMenu();
      }
      topRefs.current[next]?.focus();
    } else if (e.key === "ArrowDown" && top.sections?.length) {
      e.preventDefault();
      setOpenId(top.id);
      setPinned(true);
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`#${CSS.escape(`${baseId}-${top.id}`)} a`)
          ?.focus();
      });
    }
  }

  function onItemBlur(e: React.FocusEvent<HTMLDivElement>) {
    const next = e.relatedTarget as Node | null;
    if (next && !e.currentTarget.contains(next)) closeMenu();
  }

  const closeMobile = () => setMobileOpen(false);

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

      <header className="mkt-header" ref={headerRef}>
        <div className="mkt-wrap flex items-center justify-between gap-4 py-3">
          <SiteLogo />

          <nav
            className="mkt-nav hidden items-center gap-1 lg:flex"
            aria-label="Primary"
          >
            {mainNav.map((top, index) => {
              const panelId = `${baseId}-${top.id}`;
              const hasMenu = Boolean(top.sections?.length);

              if (!hasMenu) {
                return (
                  <Link
                    key={top.id}
                    href={top.href ?? "/"}
                    className="mkt-nav__top"
                    ref={(el) => {
                      topRefs.current[index] = el;
                    }}
                    onKeyDown={(e) => onTopKeyDown(e, index, top)}
                    onMouseEnter={() => {
                      if (!pinned) scheduleHoverClose();
                    }}
                    onClick={closeMenu}
                  >
                    {top.label}
                  </Link>
                );
              }

              const open = openId === top.id;
              return (
                <div
                  key={top.id}
                  className="mkt-nav__item"
                  onMouseEnter={() => openOnHover(top.id)}
                  onMouseLeave={scheduleHoverClose}
                  onBlur={onItemBlur}
                >
                  <button
                    type="button"
                    className="mkt-nav__top mkt-nav__top--btn"
                    aria-expanded={open}
                    aria-controls={open ? panelId : undefined}
                    aria-haspopup="true"
                    data-open={open || undefined}
                    ref={(el) => {
                      topRefs.current[index] = el;
                    }}
                    onClick={() => toggleByClick(top.id)}
                    onKeyDown={(e) => onTopKeyDown(e, index, top)}
                  >
                    {top.label}
                    <ChevronDown
                      className="mkt-nav__chev"
                      size={14}
                      aria-hidden="true"
                    />
                  </button>
                  {open ? (
                    <MegaPanel
                      id={panelId}
                      label={top.label}
                      sections={top.sections ?? []}
                      highlight={top.highlight}
                      onNavigate={closeMenu}
                    />
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <Link
              href={headerCtas.secondary.href}
              className="mkt-btn mkt-btn--secondary hidden xl:inline-flex"
              onClick={closeMenu}
            >
              {headerCtas.secondary.label}
            </Link>
            <Link
              href={headerCtas.primary.href}
              className="mkt-btn mkt-btn--primary"
              data-mkt-schedule
              onClick={closeMenu}
            >
              {headerCtas.primary.label}
            </Link>
          </div>

          <button
            type="button"
            ref={menuButtonRef}
            className="mkt-btn mkt-btn--secondary mkt-menu-btn lg:!hidden"
            aria-expanded={mobileOpen}
            aria-controls="mkt-mobile-nav"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} aria-hidden="true" />
            <span>Menu</span>
          </button>
        </div>
      </header>

      {mobileOpen ? (
        <MobileMenu
          onClose={() => {
            closeMobile();
            menuButtonRef.current?.focus();
          }}
          onNavigate={closeMobile}
        />
      ) : null}
    </>
  );
}
