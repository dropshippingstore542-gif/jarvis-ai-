import { useEffect, useState } from "react";
import { api } from "./lib/api";
import type { AssistantStatus, BrainEvent, Conversation, PendingAction } from "./lib/types";
import { StatusBadge } from "./components/StatusBadge";
import { ChatView } from "./components/ChatView";
import { MemoryPanel } from "./components/MemoryPanel";
import { AuditLogPanel } from "./components/AuditLogPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { AutomationsPanel } from "./components/AutomationsPanel";
import { ApprovalModal } from "./components/ApprovalModal";

type View = "chat" | "memory" | "audit" | "automations" | "settings";

const VIEW_LABELS: Record<View, string> = {
  chat: "Conversation",
  memory: "Memory",
  audit: "Audit Log",
  automations: "Automations",
  settings: "Settings",
};

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<View>("chat");
  const [status, setStatus] = useState<AssistantStatus>("idle");
  const [pendingQueue, setPendingQueue] = useState<PendingAction[]>([]);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    const { conversations } = await api.listConversations();
    const first = conversations[0];
    if (first) {
      setConversations(conversations);
      setActiveId(first.id);
      return;
    }
    const created = await api.createConversation("First conversation");
    setConversations([created]);
    setActiveId(created.id);
  }

  async function newConversation() {
    const created = await api.createConversation();
    setConversations((prev) => [created, ...prev]);
    setActiveId(created.id);
    setView("chat");
  }

  function onEvent(event: BrainEvent) {
    if (event.type === "status") setStatus(event.status);
    if (event.type === "pending_action_created") {
      setPendingQueue((prev) => [...prev, event.action]);
    }
    if (event.type === "pending_action_resolved") {
      setPendingQueue((prev) => prev.filter((a) => a.id !== event.action.id));
    }
  }

  async function resolveApproval(id: string, approved: boolean) {
    await api.resolveApproval(id, approved);
    setPendingQueue((prev) => prev.filter((a) => a.id !== id));
  }

  const current = pendingQueue[0];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          JARVIS<span className="dot">.</span>
        </div>

        {(["chat", "memory", "audit", "automations", "settings"] as View[]).map((v) => (
          <button key={v} className={`nav-item ${view === v ? "active" : ""}`} onClick={() => setView(v)}>
            {VIEW_LABELS[v]}
          </button>
        ))}

        <div className="sidebar-section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Conversations</span>
          <button className="nav-item" style={{ padding: "2px 6px" }} onClick={() => void newConversation()}>
            +
          </button>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {conversations.map((c) => (
            <button
              key={c.id}
              className={`conversation-item ${c.id === activeId ? "active" : ""}`}
              onClick={() => {
                setActiveId(c.id);
                setView("chat");
              }}
            >
              {c.title}
            </button>
          ))}
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <h1>{VIEW_LABELS[view]}</h1>
          <StatusBadge status={status} />
        </div>

        {view === "chat" && activeId && (
          <ChatView conversationId={activeId} onEvent={onEvent} onNavigate={(v) => setView(v)} />
        )}
        {view === "memory" && <MemoryPanel />}
        {view === "audit" && <AuditLogPanel />}
        {view === "automations" && <AutomationsPanel />}
        {view === "settings" && <SettingsPanel />}
      </main>

      {current && (
        <ApprovalModal action={current} onResolve={(approved) => void resolveApproval(current.id, approved)} />
      )}
    </div>
  );
}
