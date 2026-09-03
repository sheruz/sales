import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/permissions";

const publicPages = [
  "/",
  "/login",
  "/invite",
  "/forgot-password",
  "/reset-password",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

  const isApiRoute = pathname.startsWith("/api");
  // Route handlers enforce auth; cron/webhook/public APIs stay open here.
  if (isApiRoute) {
    return NextResponse.next();
  }

  const isPublicPage = publicPages.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isPlatformRoute = pathname.startsWith("/platform");

  if ((isDashboardRoute || isPlatformRoute) && !sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && sessionToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isPublicPage && !isDashboardRoute && !isPlatformRoute && !sessionToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
