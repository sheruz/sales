import { join } from "path";

/** Writable branding root — runtime uploads land here. */
export function brandingRootDir(): string {
  const custom = process.env.BRANDING_UPLOAD_DIR?.trim();
  if (custom) return custom;
  return join(process.cwd(), "public", "branding");
}

export function brandingAbsPath(orgId: string, filename: string): string {
  return join(brandingRootDir(), orgId, filename);
}
