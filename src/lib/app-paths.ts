/**
 * Obscure app entry paths (not /dashboard or /platform).
 * Set NEXT_PUBLIC_APP_HOME_BASE / NEXT_PUBLIC_APP_OPS_BASE in .env (must start with /).
 * Middleware rewrites these → internal /dashboard and /platform folders.
 */

function normalizeBase(raw: string | undefined, fallback: string): string {
  const v = (raw || fallback).trim();
  const withSlash = v.startsWith("/") ? v : `/${v}`;
  return withSlash.replace(/\/+$/, "") || fallback;
}

/** Tenant app UI (was /dashboard) */
export const APP_HOME_BASE = normalizeBase(
  process.env.NEXT_PUBLIC_APP_HOME_BASE,
  "/w-dlx7k9m2"
);

/** Super-admin console (was /platform) */
export const APP_OPS_BASE = normalizeBase(
  process.env.NEXT_PUBLIC_APP_OPS_BASE,
  "/ops-dlx3n8p4"
);

/** Legacy path prefixes — blocked publicly (404). */
export const LEGACY_HOME_BASE = "/dashboard";
export const LEGACY_OPS_BASE = "/platform";

export function appHome(subpath = ""): string {
  if (!subpath || subpath === "/") return APP_HOME_BASE;
  const rest = subpath.startsWith("/") ? subpath : `/${subpath}`;
  return `${APP_HOME_BASE}${rest}`;
}

export function appOps(subpath = ""): string {
  if (!subpath || subpath === "/") return APP_OPS_BASE;
  const rest = subpath.startsWith("/") ? subpath : `/${subpath}`;
  return `${APP_OPS_BASE}${rest}`;
}

/** Map a legacy or public path to the current public path (for redirects). */
export function modernizeAppPath(pathname: string): string {
  if (pathname === LEGACY_HOME_BASE || pathname.startsWith(`${LEGACY_HOME_BASE}/`)) {
    return APP_HOME_BASE + pathname.slice(LEGACY_HOME_BASE.length);
  }
  if (pathname === LEGACY_OPS_BASE || pathname.startsWith(`${LEGACY_OPS_BASE}/`)) {
    // Don't rewrite API
    if (pathname.startsWith("/api/")) return pathname;
    return APP_OPS_BASE + pathname.slice(LEGACY_OPS_BASE.length);
  }
  return pathname;
}
