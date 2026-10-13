import { redirect } from "next/navigation";

/**
 * Fallback only. Production `/` is rewritten to `/landing.html` in next.config
 * (static HTML — no React layout). This stub keeps the App Router + tsc happy.
 */
export default function HomePage() {
  redirect("/landing.html");
}
