import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getEnv } from "@/lib/config/env";
import { SESSION_COOKIE } from "@/lib/auth/permissions";
import type { AuthUser } from "@/types/auth";

function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(
  userId: string,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<string> {
  const { SESSION_EXPIRY_HOURS } = getEnv();
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    },
  });

  return token;
}

export async function getSessionUser(token: string): Promise<AuthUser | null> {
  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          avatarUrl: true,
          isActive: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }
  if (!session.user.isActive || session.user.deletedAt) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    role: session.user.role,
    avatarUrl: session.user.avatarUrl,
  };
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}

export async function deleteUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

export function setSessionCookie(
  response: NextResponse,
  token: string
): NextResponse {
  const { SESSION_EXPIRY_HOURS, NODE_ENV } = getEnv();

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_EXPIRY_HOURS * 60 * 60,
  });

  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: getEnv().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export async function getSessionTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getSessionTokenFromCookies();
  if (!token) return null;
  return getSessionUser(token);
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
