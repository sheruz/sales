import { redirect } from "next/navigation";

/** Analytics lives on the main Dashboard — keep old URLs working. */
export default function AnalyticsPage() {
  redirect("/dashboard");
}
