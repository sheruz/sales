import crypto from "crypto";
import { env } from "@/lib/config/env";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = env.ENCRYPTION_KEY;
  if (!key || key.length < 16) {
    throw new Error("ENCRYPTION_KEY must be set to store LinkedIn credentials");
  }
  return crypto.createHash("sha256").update(key).digest();
}

export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(payload: string): string {
  const key = getKey();
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Invalid encrypted payload");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export function isEncryptionConfigured(): boolean {
  return Boolean(env.ENCRYPTION_KEY && env.ENCRYPTION_KEY.length >= 16);
}
