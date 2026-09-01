import { automationService } from "@/services/automation.service";

export async function runAutomationJobs() {
  return automationService.processPendingJobs();
}
