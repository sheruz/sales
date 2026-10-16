import { appHome } from "@/lib/app-paths";
import { redirect } from "next/navigation";

/** Legacy assistant route → Phase 12 agent console */
export default function AssistantPage() {
  redirect(appHome("/agent"));
}
