import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { AuditLogEntry } from "../lib/types";

export function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const { entries } = await api.listAuditLog();
    setEntries(entries);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Audit Log</h2>
        <button className="btn secondary" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      {loading && <div className="empty-state">Loading…</div>}
      {!loading && entries.length === 0 && <div className="empty-state">No tool executions yet.</div>}

      {entries.map((e) => (
        <div className="card" key={e.id}>
          <div className="card-title">
            {e.toolName}{" "}
            <span
              style={{
                color:
                  e.result === "success" ? "var(--ok)" : e.result === "denied" ? "var(--warn)" : "var(--danger)",
                fontSize: 12,
                textTransform: "uppercase",
                marginLeft: 6,
              }}
            >
              {e.result}
            </span>
          </div>
          <div className="modal-code" style={{ marginTop: 6 }}>
            {e.inputSummary}
          </div>
          {e.errorMessage && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{e.errorMessage}</div>}
          <div className="card-meta">
            <span className={`tag permission-${e.permission}`}>{e.permission}</span>
            <span>{e.approved ? "approved" : "not approved"}</span>
            {e.approvedBy && <span>by {e.approvedBy}</span>}
            <span>{e.durationMs}ms</span>
            <span>{new Date(e.timestamp).toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
