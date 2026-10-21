import { redirect } from "next/navigation";
import { appOps } from "@/lib/app-paths";

/** B4b: Revenue merged into Dashboard (env switch + chart). */
export default function PlatformRevenueRedirect() {
  redirect(appOps());
}
