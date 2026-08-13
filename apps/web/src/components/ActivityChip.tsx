import type { ActivityEntry } from "../lib/types";

const LABEL: Record<ActivityEntry["status"], string> = {
  running: "running",
  success: "done",
  error: "failed",
  awaiting_approval: "awaiting approval",
};

export function ActivityChip({ entry }: { entry: ActivityEntry }) {
  return (
    <div className={`activity-chip ${entry.status}`}>
      <span className="icon" />
      <span>
        {entry.toolName} · {LABEL[entry.status]}
      </span>
      {entry.error && <span style={{ color: "var(--danger)" }}>— {entry.error}</span>}
      {entry.verified === false && <span style={{ color: "var(--warn)" }}>— unverified</span>}
    </div>
  );
}
