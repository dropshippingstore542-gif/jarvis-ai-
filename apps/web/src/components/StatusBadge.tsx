import type { AssistantStatus } from "../lib/types";

const LABELS: Record<AssistantStatus, string> = {
  listening: "Listening",
  thinking: "Thinking",
  working: "Working",
  waiting_for_approval: "Waiting for approval",
  speaking: "Speaking",
  idle: "Idle",
};

export function StatusBadge({ status }: { status: AssistantStatus }) {
  return (
    <div className="status-badge">
      <span className={`status-dot ${status}`} />
      {LABELS[status]}
    </div>
  );
}
