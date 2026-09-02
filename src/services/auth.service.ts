import prisma from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  deleteSession,
  getSessionUser,
} from "@/lib/auth/session";
import { UnauthorizedError, ValidationError } from "@/lib/api/response";
import { logger } from "@/lib/logger";
import type { AuthUser } from "@/types/auth";
import type { CreateUserInput, UpdateUserInput } from "@/lib/auth/schemas";

interface SessionMeta {
  ipAddress?: string;
  userAgent?: string;
}

export class AuthService {
  async login(
    email: string,
    password: string,
    meta?: SessionMeta
  ): Promise<{ user: AuthUser; token: string }> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        passwordHash: true,
        isActive: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedError("Invalid email or password");
    }

    if (!user.isActive) {
      throw new UnauthorizedError("Account is deactivated");
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const token = await createSession(user.id, meta);

    logger.info("User logged in", { userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      token,
    };
  }

  async logout(token: string): Promise<void> {
    await deleteSession(token);
  }

  async getCurrentUser(token: string): Promise<AuthUser | null> {
    return getSessionUser(token);
  }

  async listUsers() {
    return prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createUser(input: CreateUserInput) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ValidationError("Email already in use");
    }

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase().trim(),
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    logger.info("User created", { userId: user.id, email: user.email });
    return user;
  }

  async updateUser(userId: string, input: UpdateUserInput) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new ValidationError("User not found");
    }

    return prisma.user.update({
      where: { id: userId },
      data: input,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async updateProfile(userId: string, input: { firstName: string; lastName: string; email: string }) {
    const email = input.email.toLowerCase().trim();
    const existing = await prisma.user.findFirst({
      where: { email, NOT: { id: userId } },
    });
    if (existing) throw new ValidationError("Email already in use");

    return prisma.user.update({
      where: { id: userId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
      },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new ValidationError("User not found");

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedError("Current password is incorrect");

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async deactivateUser(userId: string, actorId: string) {
    if (userId === actorId) {
      throw new ValidationError("Cannot deactivate your own account");
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false, deletedAt: new Date() },
    });

    await prisma.session.deleteMany({ where: { userId } });
    logger.info("User deactivated", { userId, actorId });
  }
}

export const authService = new AuthService();
