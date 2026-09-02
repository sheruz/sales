import { encrypt, decrypt, isEncryptionConfigured } from "@/lib/crypto/encrypt";

export function encryptCredentials(data: Record<string, string>): string {
  if (!isEncryptionConfigured()) {
    throw new Error("ENCRYPTION_KEY must be set to store integration credentials");
  }
  return encrypt(JSON.stringify(data));
}

export function decryptCredentials(payload: string): Record<string, string> {
  return JSON.parse(decrypt(payload)) as Record<string, string>;
}

export function maskSecret(value: string, visible = 4): string {
  if (value.length <= visible * 2) return "••••••••";
  return `${value.slice(0, visible)}••••${value.slice(-visible)}`;
}
