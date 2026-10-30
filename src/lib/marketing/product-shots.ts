import fs from "fs";
import path from "path";

/** Keys for ProductShot — PNG under /public/marketing/screens/ when present. */
export type ProductShotName =
  | "revenue-os-dashboard"
  | "revenue-os-deep-audit"
  | "revenue-os-pipeline"
  | "revenue-os-superadmin-packages";

const FALLBACK_SVG: Record<ProductShotName, string> = {
  "revenue-os-dashboard": "/marketing/screenshots/revenue-os-dashboard.svg",
  "revenue-os-deep-audit": "/marketing/screenshots/revenue-os-audit.svg",
  "revenue-os-pipeline": "/marketing/screenshots/revenue-os-pipeline.svg",
  "revenue-os-superadmin-packages":
    "/marketing/screenshots/revenue-os-packages.svg",
};

const PNG_FILE: Record<ProductShotName, string> = {
  "revenue-os-dashboard": "revenue-os-dashboard.png",
  "revenue-os-deep-audit": "revenue-os-deep-audit.png",
  "revenue-os-pipeline": "revenue-os-pipeline.png",
  "revenue-os-superadmin-packages": "revenue-os-superadmin-packages.png",
};

/** Resolve a product shot: real PNG if dropped in screens/, else finished SVG fallback. */
export function resolveProductShot(name: ProductShotName): {
  src: string;
  isRaster: boolean;
} {
  const file = PNG_FILE[name];
  const abs = path.join(process.cwd(), "public", "marketing", "screens", file);
  if (fs.existsSync(abs)) {
    return { src: `/marketing/screens/${file}`, isRaster: true };
  }
  return { src: FALLBACK_SVG[name], isRaster: false };
}
