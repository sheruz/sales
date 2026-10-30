import fs from "fs";
import path from "path";

/**
 * Canvas image slot IDs → public file names under /public/marketing/.
 * Prefer short ID (home-01.webp); fall back to descriptive checklist name.
 */
export const SLOT_FILES: Record<string, string[]> = {
  "HOME-01": ["home-01.webp", "home-01-revenue-os-dashboard.webp"],
  "HOME-02": ["home-02.webp", "home-02-deep-audit-findings.webp"],
  "HOME-03": ["home-03.webp", "home-03-founder.webp"],
  "HOME-04": ["home-04.webp", "home-04-pipeline.webp"],
  "HOME-05": ["home-05.webp", "home-05-on-call.webp"],
  "HOME-IND-1": ["home-ind-1.webp", "home-ind-1-trucking.webp"],
  "HOME-IND-2": ["home-ind-2.webp", "home-ind-2-real-estate.webp"],
  "HOME-IND-3": ["home-ind-3.webp", "home-ind-3-clinic.webp"],
  "HOME-IND-4": ["home-ind-4.webp", "home-ind-4-construction.webp"],
  "HOME-IND-5": ["home-ind-5.webp", "home-ind-5-retail.webp"],
  "HOME-IND-6": ["home-ind-6.webp", "home-ind-6-services.webp"],
  "HOME-IND-7": ["home-ind-7.webp", "home-ind-7-education.webp"],
  "HOME-IND-8": ["home-ind-8.webp", "home-ind-8-startup.webp"],
  "MENU-01": ["menu-01.webp", "menu-01-audit-report.webp"],
  "SVC-01": ["svc-01.webp", "svc-01-web-app-dashboard.webp"],
  "SVC-02": ["svc-02.webp", "svc-02-mobile-view.webp"],
  "SVC-03": ["svc-03.webp", "svc-03-revenue-os.webp"],
  "IND-01": ["ind-01.webp", "ind-01-trucking-hero.webp"],
  "IND-02": ["ind-02.webp", "ind-02-dispatch-board.webp"],
  "IND-03": ["ind-03.webp", "ind-03-driver-application.webp"],
  "IND-04": ["ind-04.webp", "ind-04-quote-form.webp"],
  "IND-05": ["ind-05.webp", "ind-05-document-library.webp"],
  "CS-01": ["cs-01.webp", "cs-01-revenue-os-dashboard-wide.webp"],
  "CS-02": ["cs-02.webp", "cs-02-deep-audit-findings.webp"],
  "CS-03": ["cs-03.webp", "cs-03-pipeline.webp"],
  "CS-04": ["cs-04.webp", "cs-04-super-admin-packages.webp"],
  "CS-05": ["cs-05.webp", "cs-05-pitch-review.webp"],
  "AUDIT-01": ["audit-01.webp", "audit-01-sample-report.webp"],
  "ABOUT-01": ["about-01.webp", "about-01-founder.webp"],
  "ABOUT-02": ["about-02.webp", "about-02-workspace.webp"],
  "ABOUT-03": ["about-03.webp", "about-03-whiteboard.webp"],
  "ABOUT-04": ["about-04.webp", "about-04-team.webp"],
};

const marketingDir = path.join(process.cwd(), "public", "marketing");

/** Returns `/marketing/{file}` if a candidate exists on disk, else null. */
export function resolveSlotSrc(slotId: string): string | null {
  const candidates = SLOT_FILES[slotId];
  if (!candidates) return null;
  for (const file of candidates) {
    try {
      if (fs.existsSync(path.join(marketingDir, file))) {
        return `/marketing/${file}`;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function hasSlotImage(slotId: string): boolean {
  return resolveSlotSrc(slotId) !== null;
}
