import { createHash, randomUUID } from "crypto";
import { mkdir, writeFile, unlink, readdir, stat, rm } from "fs/promises";
import { join, resolve, sep } from "path";
import sharp from "sharp";

const DEFAULT_MAX_BYTES = 400_000; // ~400KB after compress
const RETENTION_DAYS = 90;

export function auditEvidenceRootDir(): string {
  const custom = process.env.AUDIT_EVIDENCE_DIR?.trim();
  if (custom) return custom;
  return join(process.cwd(), "storage", "audit-evidence");
}

export function evidenceOrgDir(organizationId: string): string {
  return join(auditEvidenceRootDir(), organizationId);
}

/** Ensure path stays under org root (no traversal). */
export function resolveEvidencePath(
  organizationId: string,
  relativePath: string
): string {
  const root = resolve(evidenceOrgDir(organizationId));
  const abs = resolve(root, relativePath);
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw new Error("Invalid evidence path");
  }
  return abs;
}

export type SaveScreenshotResult = {
  relativePath: string;
  contentType: string;
  byteSize: number;
  expiresAt: Date;
};

/**
 * Compress PNG/JPEG buffer to WebP (fallback JPEG) under maxBytes.
 * Writes under storage/audit-evidence/{orgId}/{auditId}/…
 */
export async function saveAuditScreenshot(opts: {
  organizationId: string;
  websiteAuditId: string;
  kind: string;
  pngOrJpeg: Buffer;
  maxBytes?: number;
}): Promise<SaveScreenshotResult> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const dirRel = join(opts.websiteAuditId, opts.kind);
  const absDir = resolveEvidencePath(opts.organizationId, dirRel);
  await mkdir(absDir, { recursive: true });

  const hash = createHash("sha256")
    .update(opts.pngOrJpeg)
    .digest("hex")
    .slice(0, 12);
  const baseName = `${Date.now()}-${hash}`;

  let buf = await sharp(opts.pngOrJpeg)
    .resize({ width: 1440, height: 900, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
  let contentType = "image/webp";
  let ext = "webp";

  if (buf.byteLength > maxBytes) {
    buf = await sharp(opts.pngOrJpeg)
      .resize({ width: 1280, height: 800, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 65, mozjpeg: true })
      .toBuffer();
    contentType = "image/jpeg";
    ext = "jpg";
  }

  if (buf.byteLength > maxBytes) {
    buf = await sharp(buf)
      .resize({ width: 960, height: 600, fit: "inside" })
      .jpeg({ quality: 55, mozjpeg: true })
      .toBuffer();
    contentType = "image/jpeg";
    ext = "jpg";
  }

  if (buf.byteLength > maxBytes) {
    throw new Error(
      `Screenshot exceeds max size after compress (${buf.byteLength} > ${maxBytes})`
    );
  }

  const fileName = `${baseName}.${ext}`;
  const relativePath = join(dirRel, fileName).replace(/\\/g, "/");
  await writeFile(resolveEvidencePath(opts.organizationId, relativePath), buf);

  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + RETENTION_DAYS);

  return { relativePath, contentType, byteSize: buf.byteLength, expiresAt };
}

/** Delete evidence files older than retention (by mtime). Returns deleted count. */
export async function cleanupExpiredEvidence(opts?: {
  olderThanDays?: number;
  now?: Date;
}): Promise<{ deletedFiles: number; deletedDirs: number }> {
  const days = opts?.olderThanDays ?? RETENTION_DAYS;
  const cutoff = (opts?.now ?? new Date()).getTime() - days * 86_400_000;
  const root = auditEvidenceRootDir();
  let deletedFiles = 0;
  let deletedDirs = 0;

  async function walk(dir: string): Promise<boolean> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return true;
    }
    let empty = true;
    for (const ent of entries) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        const childEmpty = await walk(full);
        if (childEmpty) {
          await rm(full, { recursive: true, force: true }).catch(() => {});
          deletedDirs += 1;
        } else {
          empty = false;
        }
      } else {
        const st = await stat(full).catch(() => null);
        if (st && st.mtimeMs < cutoff) {
          await unlink(full).catch(() => {});
          deletedFiles += 1;
        } else {
          empty = false;
        }
      }
    }
    return empty;
  }

  await walk(root);
  return { deletedFiles, deletedDirs };
}

export function newEvidenceId(): string {
  return randomUUID();
}

export { RETENTION_DAYS as AUDIT_EVIDENCE_RETENTION_DAYS };
