import type {
  AuditLogEntry,
  Conversation,
  MemoryRecord,
  PendingAction,
  StoredMessage,
  ToolInfo,
} from "./types";

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4317";
export const WS_BASE = API_BASE.replace(/^http/, "ws");

const AUTH_TOKEN = import.meta.env.VITE_API_AUTH_TOKEN as string | undefined;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string; provider: string; model: string }>("/health"),

  listConversations: () => request<{ conversations: Conversation[] }>("/api/conversations"),
  createConversation: (title?: string) =>
    request<Conversation>("/api/conversations", { method: "POST", body: JSON.stringify({ title }) }),
  getMessages: (id: string) =>
    request<{ messages: StoredMessage[] }>(`/api/conversations/${id}/messages`),

  listTools: () => request<{ tools: ToolInfo[] }>("/api/tools"),

  listMemories: (q?: string) =>
    request<{ memories: MemoryRecord[] }>(`/api/memories${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  listProposedMemories: () => request<{ memories: MemoryRecord[] }>("/api/memories/proposed"),
  createMemory: (content: string, type?: string) =>
    request<MemoryRecord>("/api/memories", { method: "POST", body: JSON.stringify({ content, type }) }),
  updateMemory: (id: string, patch: { content?: string; confirm?: boolean }) =>
    request<MemoryRecord>(`/api/memories/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteMemory: (id: string) =>
    request<{ removed: boolean }>(`/api/memories/${id}`, { method: "DELETE" }),
  clearMemories: () => request<{ removed: number }>("/api/memories", { method: "DELETE" }),

  listAuditLog: (limit = 200) =>
    request<{ entries: AuditLogEntry[] }>(`/api/audit-log?limit=${limit}`),

  listPendingApprovals: () => request<{ pending: PendingAction[] }>("/api/approvals"),
  resolveApproval: (id: string, approved: boolean) =>
    request<PendingAction>(`/api/approvals/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ approved }),
    }),

  getSettings: () =>
    request<{
      ai: { provider: string; model: string };
      voice: { wakeWord: string; ttsProvider: string; sttProvider: string };
      proactiveMode: string;
      webSearchProvider: string;
      custom: Record<string, string>;
    }>("/api/settings"),
};
