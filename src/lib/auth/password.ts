import bcrypt from "bcryptjs";
import { getEnv } from "@/lib/config/env";

export async function hashPassword(password: string): Promise<string> {
  const { BCRYPT_ROUNDS } = getEnv();
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
