import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/permissions";
import {
  APP_HOME_BASE,
  APP_OPS_BASE,
  LEGACY_HOME_BASE,
  LEGACY_OPS_BASE,
} from "@/lib/app-paths";

const publicPages = [
  "/",
  "/landing.html",
  "/login",
  "/invite",
  "/forgot-password",
  "/reset-password",
  "/signup",
  "/privacy",
  "/terms",
  "/cookies",
  "/services",
  "/industries",
  "/work",
  "/about",
  "/contact",
  "/pricing",
  "/autopilot",
  "/process",
  "/faq",
  "/security",
  "/solutions",
  "/technologies",
];

function startsWithPath(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

function withPathHeader(request: NextRequest, response: NextResponse) {
  response.headers.set("x-pathname", request.nextUrl.pathname);
  return response;
}

function nextWithPath(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function rewriteWithPath(request: NextRequest, url: URL) {
  const requestHeaders = new Headers(request.headers);
  // Internal App Router path after rewrite
  requestHeaders.set("x-pathname", url.pathname);
  requestHeaders.set("x-public-pathname", request.nextUrl.pathname);
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

  const isApiRoute = pathname.startsWith("/api");
  if (isApiRoute) {
    return nextWithPath(request);
  }

  const isPublicPage = publicPages.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  const isBrandingAsset = pathname.startsWith("/branding/");
  const isEmailTrack = pathname.startsWith("/t/");

  if (isBrandingAsset || isEmailTrack) {
    return nextWithPath(request);
  }

  // Hide legacy obvious URLs
  if (
    startsWithPath(pathname, LEGACY_HOME_BASE) ||
    startsWithPath(pathname, LEGACY_OPS_BASE)
  ) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const isHomeRoute = startsWithPath(pathname, APP_HOME_BASE);
  const isOpsRoute = startsWithPath(pathname, APP_OPS_BASE);

  if ((isHomeRoute || isOpsRoute) && !sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Rewrite obscure public paths → internal App Router folders
  if (isHomeRoute) {
    const url = request.nextUrl.clone();
    url.pathname =
      LEGACY_HOME_BASE + pathname.slice(APP_HOME_BASE.length);
    return rewriteWithPath(request, url);
  }
  if (isOpsRoute) {
    const url = request.nextUrl.clone();
    url.pathname = LEGACY_OPS_BASE + pathname.slice(APP_OPS_BASE.length);
    return rewriteWithPath(request, url);
  }

  // Do NOT redirect /login → home just because a cookie exists.
  // Login page redirects only after getCurrentUser() succeeds.

  if (
    !isPublicPage &&
    !isBrandingAsset &&
    !isEmailTrack &&
    !isHomeRoute &&
    !isOpsRoute &&
    !sessionToken
  ) {
    return withPathHeader(
      request,
      NextResponse.redirect(new URL("/login", request.url))
    );
  }

  return nextWithPath(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|vendor/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|html)$).*)",
  ],
};
