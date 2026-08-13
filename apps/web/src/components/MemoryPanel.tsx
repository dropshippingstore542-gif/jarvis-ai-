import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { MemoryRecord } from "../lib/types";

export function MemoryPanel() {
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [query, setQuery] = useState("");
  const [newContent, setNewContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    const { memories } = await api.listMemories();
    setMemories(memories);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = query
    ? memories.filter((m) => m.content.toLowerCase().includes(query.toLowerCase()))
    : memories;

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Memory</h2>
        <button
          className="btn secondary"
          onClick={async () => {
            if (confirm("Clear all stored memories? This cannot be undone.")) {
              await api.clearMemories();
              void refresh();
            }
          }}
        >
          Clear all
        </button>
      </div>

      <div className="form-row" style={{ maxWidth: 420 }}>
        <label>Search</label>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search memories…" />
      </div>

      <div className="form-row" style={{ maxWidth: 420 }}>
        <label>Remember something</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="e.g. I prefer concise answers"
          />
          <button
            className="btn"
            disabled={newContent.trim().length < 3}
            onClick={async () => {
              await api.createMemory(newContent.trim());
              setNewContent("");
              void refresh();
            }}
          >
            Save
          </button>
        </div>
      </div>

      {loading && <div className="empty-state">Loading…</div>}
      {!loading && filtered.length === 0 && <div className="empty-state">No memories yet.</div>}

      {filtered.map((m) => (
        <div className="card" key={m.id}>
          <div className="card-title">{m.content}</div>
          <div className="card-meta">
            <span className="tag">{m.type}</span>
            <span className="tag">{m.status}</span>
            <span className="tag">{m.source}</span>
            <span>{new Date(m.updatedAt).toLocaleString()}</span>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            {m.status === "proposed" && (
              <button
                className="btn secondary"
                onClick={async () => {
                  await api.updateMemory(m.id, { confirm: true });
                  void refresh();
                }}
              >
                Confirm
              </button>
            )}
            <button
              className="btn danger"
              onClick={async () => {
                await api.deleteMemory(m.id);
                void refresh();
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
