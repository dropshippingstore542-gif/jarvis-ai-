export type AutomationRunStatus = "running" | "success" | "failure";

export interface Automation {
  id: string;
  name: string;
  cronExpression: string;
  /** Natural-language task sent through the orchestrator when this fires. */
  prompt: string;
  enabled: boolean;
  conversationId?: string;
  nextRunAt?: string;
  lastRunAt?: string;
  lastRunStatus?: AutomationRunStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  startedAt: string;
  finishedAt?: string;
  status: AutomationRunStatus;
  summary?: string;
}
