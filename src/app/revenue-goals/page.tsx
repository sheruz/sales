import { appHome } from "@/lib/app-paths";
import { redirect } from "next/navigation";

export default function RevenueGoalsRedirect() {
  redirect(appHome("/revenue-goals"));
}
