import { redirect } from "next/navigation";

/** Legacy assistant route → Phase 12 agent console */
export default function AssistantPage() {
  redirect("/dashboard/agent");
}
