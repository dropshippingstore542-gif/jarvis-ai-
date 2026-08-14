import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Automation, AutomationRun } from "../lib/types";

const STATUS_COLOR: Record<string, string> = {
  success: "var(--ok)",
  failure: "var(--danger)",
  running: "var(--accent)",
};

export function AutomationsPanel() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [cronExpression, setCronExpression] = useState("0 8 * * *");
  const [prompt, setPrompt] = useState("");

  async function refresh() {
    setLoading(true);
    const { automations } = await api.listAutomations();
    setAutomations(automations);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    const { runs } = await api.listAutomationRuns(id);
    setRuns(runs);
  }

  async function create() {
    setError(null);
    try {
      await api.createAutomation({ name: name.trim(), cronExpression: cronExpression.trim(), prompt: prompt.trim() });
      setName("");
      setPrompt("");
      void refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Automations</h2>
      </div>

      <div className="card">
        <div className="card-title">New automation</div>
        <div className="form-row">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning briefing" />
        </div>
        <div className="form-row">
          <label>Cron schedule (5-field, server local time)</label>
          <input value={cronExpression} onChange={(e) => setCronExpression(e.target.value)} placeholder="0 8 * * *" />
        </div>
        <div className="form-row">
          <label>Task (sent to the assistant when it fires)</label>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Check my schedule and summarize today's important tasks."
          />
        </div>
        {error && <div style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <button className="btn" disabled={!name.trim() || !cronExpression.trim() || !prompt.trim()} onClick={() => void create()}>
          Create
        </button>
      </div>

      {loading && <div className="empty-state">Loading…</div>}
      {!loading && automations.length === 0 && <div className="empty-state">No automations yet.</div>}

      {automations.map((a) => (
        <div className="card" key={a.id}>
          <div className="card-title" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{a.name}</span>
            <span
              style={{
                fontSize: 11,
                color: a.enabled ? "var(--ok)" : "var(--text-faint)",
                textTransform: "uppercase",
              }}
            >
              {a.enabled ? "enabled" : "disabled"}
            </span>
          </div>
          <div className="card-meta">
            <span className="tag">{a.cronExpression}</span>
            {a.lastRunStatus && (
              <span style={{ color: STATUS_COLOR[a.lastRunStatus] }}>last run: {a.lastRunStatus}</span>
            )}
            {a.nextRunAt && <span>next: {new Date(a.nextRunAt).toLocaleString()}</span>}
          </div>
          <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--text-dim)" }}>{a.prompt}</div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn secondary"
              onClick={async () => {
                await api.setAutomationEnabled(a.id, !a.enabled);
                void refresh();
              }}
            >
              {a.enabled ? "Disable" : "Enable"}
            </button>
            <button
              className="btn secondary"
              onClick={async () => {
                await api.runAutomationNow(a.id);
                void refresh();
                if (expanded === a.id) void toggleExpand(a.id).then(() => toggleExpand(a.id));
              }}
            >
              Run now
            </button>
            <button className="btn secondary" onClick={() => void toggleExpand(a.id)}>
              {expanded === a.id ? "Hide history" : "View history"}
            </button>
            <button
              className="btn danger"
              onClick={async () => {
                if (confirm(`Delete automation "${a.name}"?`)) {
                  await api.deleteAutomation(a.id);
                  void refresh();
                }
              }}
            >
              Delete
            </button>
          </div>

          {expanded === a.id && (
            <div style={{ marginTop: 12 }}>
              {runs.length === 0 && <div className="empty-state">No runs yet.</div>}
              {runs.map((r) => (
                <div key={r.id} className="modal-code" style={{ marginBottom: 6 }}>
                  <span style={{ color: STATUS_COLOR[r.status] }}>{r.status}</span> ·{" "}
                  {new Date(r.startedAt).toLocaleString()}
                  {r.summary ? ` — ${r.summary}` : ""}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
