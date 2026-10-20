/**
 * B4a: TOTP 2FA for Super Admin (enforced after first enrollment).
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import prisma from "@/lib/db/prisma";
import { ValidationError } from "@/lib/api/response";
import { encryptCredentials, decryptCredentials } from "@/lib/integrations/credentials";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { organizationService } from "@/services/organization.service";
import { UserRole } from "@prisma/client";

const ISSUER = "Delvix Platform";

function base32Encode(buf: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = input.replace(/=+$/, "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpCode(secretBase32: string, at = Date.now()): string {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(at / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

function codesEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a.padStart(6, "0"));
  const bb = Buffer.from(b.padStart(6, "0"));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export class MfaService {
  async getStatus(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        totpEnabledAt: true,
        totpEnrollmentRequired: true,
        role: true,
        platformRole: true,
      },
    });
    const isSuperAdmin =
      user.role === UserRole.SUPER_ADMIN ||
      user.platformRole === "SUPER_ADMIN";
    return {
      enabled: Boolean(user.totpEnabledAt),
      enrollmentRequired: Boolean(user.totpEnrollmentRequired) && isSuperAdmin,
      mustEnroll: isSuperAdmin && !user.totpEnabledAt,
      challengeRequired: isSuperAdmin && Boolean(user.totpEnabledAt),
    };
  }

  async beginSetup(userId: string) {
    const secret = base32Encode(randomBytes(20));
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    await prisma.user.update({
      where: { id: userId },
      data: {
        totpSecretEnc: encryptCredentials({ secret }),
        // not enabled until verify
        totpEnabledAt: null,
      },
    });
    const otpauth = `otpauth://totp/${encodeURIComponent(ISSUER)}:${encodeURIComponent(user.email)}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=6&period=30`;
    return { secret, otpauthUrl: otpauth };
  }

  async confirmSetup(userId: string, code: string, actorUserId?: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { totpSecretEnc: true, email: true },
    });
    if (!user.totpSecretEnc) {
      throw new ValidationError("Start 2FA setup first");
    }
    const { secret } = decryptCredentials(user.totpSecretEnc);
    if (!secret) throw new ValidationError("Invalid 2FA secret");

    const ok =
      codesEqual(generateTotpCode(secret), code.trim()) ||
      codesEqual(generateTotpCode(secret, Date.now() - 30_000), code.trim()) ||
      codesEqual(generateTotpCode(secret, Date.now() + 30_000), code.trim());
    if (!ok) throw new ValidationError("Invalid authenticator code");

    const recoveryPlain: string[] = [];
    const recoveryHashes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const plain = randomBytes(5).toString("hex");
      recoveryPlain.push(plain);
      recoveryHashes.push(await hashPassword(plain));
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabledAt: new Date(),
        totpEnrollmentRequired: false,
        totpRecoveryCodesEnc: encryptCredentials({
          hashes: JSON.stringify(recoveryHashes),
        }),
      },
    });

    await organizationService.writePlatformAudit({
      actorUserId: actorUserId || userId,
      action: "mfa.enabled",
      targetType: "user",
      targetId: userId,
      after: { enabled: true },
    });

    return { recoveryCodes: recoveryPlain };
  }

  async verifyLoginCode(userId: string, code: string): Promise<boolean> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        totpSecretEnc: true,
        totpEnabledAt: true,
        totpRecoveryCodesEnc: true,
      },
    });
    if (!user.totpEnabledAt || !user.totpSecretEnc) return true; // not enrolled yet
    const trimmed = code.trim();
    if (!trimmed) return false;

    const { secret } = decryptCredentials(user.totpSecretEnc);
    if (secret) {
      const ok =
        codesEqual(generateTotpCode(secret), trimmed) ||
        codesEqual(generateTotpCode(secret, Date.now() - 30_000), trimmed) ||
        codesEqual(generateTotpCode(secret, Date.now() + 30_000), trimmed);
      if (ok) return true;
    }

    // Recovery code (one-time)
    if (user.totpRecoveryCodesEnc && trimmed.length >= 8) {
      const { hashes } = decryptCredentials(user.totpRecoveryCodesEnc);
      const list: string[] = hashes ? JSON.parse(hashes) : [];
      for (let i = 0; i < list.length; i++) {
        if (await verifyPassword(trimmed, list[i])) {
          list.splice(i, 1);
          await prisma.user.update({
            where: { id: userId },
            data: {
              totpRecoveryCodesEnc: encryptCredentials({
                hashes: JSON.stringify(list),
              }),
            },
          });
          return true;
        }
      }
    }
    return false;
  }

  /** Server break-glass — clears 2FA so user can re-enroll. */
  async resetForEmail(email: string, reason: string) {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), deletedAt: null },
    });
    if (!user) throw new ValidationError("User not found");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecretEnc: null,
        totpEnabledAt: null,
        totpRecoveryCodesEnc: null,
        totpEnrollmentRequired: true,
      },
    });
    await organizationService.writePlatformAudit({
      action: "mfa.reset_break_glass",
      targetType: "user",
      targetId: user.id,
      reason,
      after: { email: user.email, cleared: true },
    });
    return { ok: true, userId: user.id, email: user.email };
  }
}

export const mfaService = new MfaService();
