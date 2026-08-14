import { useState } from "react";
import type { PendingAction } from "../lib/types";

export function ApprovalModal({
  action,
  onResolve,
}: {
  action: PendingAction;
  onResolve: (approved: boolean) => void;
}) {
  const highRisk = action.permission === "high";
  const [confirmText, setConfirmText] = useState("");
  const confirmed = !highRisk || confirmText.trim().toUpperCase() === "CONFIRM";

  return (
    <div className="modal-overlay">
      <div className={`modal ${highRisk ? "high-risk" : ""}`}>
        {highRisk && <div className="modal-warning">⚠ High-risk action</div>}
        <div className="modal-title">Jarvis wants to run: {action.toolName}</div>
        <div className="modal-body">{action.reason}</div>
        <div className="modal-code">{JSON.stringify(action.input, null, 2)}</div>

        {highRisk && (
          <div className="form-row" style={{ marginTop: 14 }}>
            <label>Type CONFIRM to approve this high-risk action</label>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="CONFIRM" />
          </div>
        )}

        <div className="modal-actions">
          <button className="btn secondary" onClick={() => onResolve(false)}>
            {highRisk ? "Cancel" : "Deny"}
          </button>
          <button
            className={`btn ${highRisk ? "danger" : ""}`}
            disabled={!confirmed}
            onClick={() => onResolve(true)}
          >
            {highRisk ? "Confirm" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}
