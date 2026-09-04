import { AppError } from "@/lib/api/response";
import { logger } from "@/lib/logger";

type Attempt = { failures: number; lockedUntil: number };

const attempts = new Map<string, Attempt>();

const MAX_FAILURES = 8;
const LOCK_MS = 15 * 60 * 1000;

/**
 * Brute-force protection for login (per email + IP).
 */
export function assertNotLockedOut(email: string, ip: string) {
  const now = Date.now();
  for (const key of [`email:${email.toLowerCase()}`, `ip:${ip}`]) {
    const row = attempts.get(key);
    if (row && row.lockedUntil > now) {
      throw new AppError(
        "Too many failed login attempts. Try again later.",
        429,
        "ACCOUNT_LOCKED"
      );
    }
  }
}

export function recordLoginFailure(email: string, ip: string) {
  const now = Date.now();
  for (const key of [`email:${email.toLowerCase()}`, `ip:${ip}`]) {
    let row = attempts.get(key);
    if (!row) {
      row = { failures: 0, lockedUntil: 0 };
      attempts.set(key, row);
    }
    // Clear expired lockouts
    if (row.lockedUntil > 0 && row.lockedUntil <= now) {
      row.failures = 0;
      row.lockedUntil = 0;
    }
    row.failures += 1;
    if (row.failures >= MAX_FAILURES) {
      row.lockedUntil = now + LOCK_MS;
      logger.warn("Login lockout triggered", { key });
    }
  }
}

export function clearLoginFailures(email: string, ip: string) {
  attempts.delete(`email:${email.toLowerCase()}`);
  attempts.delete(`ip:${ip}`);
}

export function clearBruteForceForTests() {
  attempts.clear();
}
