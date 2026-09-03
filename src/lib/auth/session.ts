import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getEnv } from "@/lib/config/env";
import { SESSION_COOKIE } from "@/lib/auth/permissions";
import { resolveMembershipPermissions } from "@/lib/tenant/rbac";
import type { AuthUser } from "@/types/auth";
import { UserRole } from "@prisma/client";

function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(
  userId: string,
  meta?: {
    ipAddress?: string;
    userAgent?: string;
    organizationId?: string | null;
  }
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
      activeOrganizationId: meta?.organizationId ?? null,
    },
  });

  return token;
}

async function buildAuthUser(
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    avatarUrl: string | null;
  },
  activeOrganizationId: string | null
): Promise<AuthUser> {
  const isPlatformAdmin = user.role === UserRole.SUPER_ADMIN;

  let organizationId: string | null = null;
  let organizationName: string | null = null;
  let organizationSlug: string | null = null;
  let organizationRoleKey: string | null = null;
  let permissions: AuthUser["permissions"] = [];

  if (isPlatformAdmin) {
    permissions = ["platform.manage"];
    // Platform admins may optionally act inside an org for support
    if (activeOrganizationId) {
      const org = await prisma.organization.findFirst({
        where: { id: activeOrganizationId, deletedAt: null },
      });
      if (org && org.status !== "SUSPENDED" && org.status !== "CANCELLED") {
        organizationId = org.id;
        organizationName = org.name;
        organizationSlug = org.slug;
        organizationRoleKey = "platform_admin";
      }
    }
  } else {
    let orgId = activeOrganizationId;
    if (!orgId) {
      const primary = await prisma.organizationUser.findFirst({
        where: { userId: user.id, status: "ACTIVE" },
        orderBy: [{ isPrimaryAdmin: "desc" }, { createdAt: "asc" }],
      });
      orgId = primary?.organizationId ?? null;
    }

    if (orgId) {
      const resolved = await resolveMembershipPermissions(user.id, orgId);
      if (resolved) {
        organizationId = resolved.membership.organizationId;
        organizationName = resolved.membership.organization.name;
        organizationSlug = resolved.membership.organization.slug;
        organizationRoleKey = resolved.membership.role.key;
        permissions = resolved.permissions;

        await prisma.organizationUser.update({
          where: { id: resolved.membership.id },
          data: { lastActiveAt: new Date() },
        });
      }
    }
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    isPlatformAdmin,
    organizationId,
    organizationName,
    organizationSlug,
    organizationRoleKey,
    permissions,
  };
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

  return buildAuthUser(session.user, session.activeOrganizationId);
}

export async function setActiveOrganization(
  token: string,
  organizationId: string | null
): Promise<void> {
  await prisma.session.updateMany({
    where: { token },
    data: { activeOrganizationId: organizationId },
  });
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
