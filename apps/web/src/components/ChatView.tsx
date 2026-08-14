import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useConversationSocket } from "../lib/useConversationSocket";
import type { ActivityEntry, BrainEvent } from "../lib/types";
import { ActivityChip } from "./ActivityChip";
import { QuickActions } from "./QuickActions";

type TimelineItem =
  | { kind: "message"; id: string; role: "user" | "assistant"; content: string; streaming?: boolean }
  | { kind: "activity"; id: string; entry: ActivityEntry };

export function ChatView({
  conversationId,
  onEvent,
  onNavigate,
}: {
  conversationId: string;
  onEvent: (event: BrainEvent) => void;
  onNavigate: (view: "automations") => void;
}) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingIdRef = useRef<string | null>(null);

  useEffect(() => {
    setTimeline([]);
    api.getMessages(conversationId).then(({ messages }) => {
      setTimeline(
        messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .filter((m) => m.content.trim().length > 0)
          .map((m) => ({ kind: "message", id: m.id, role: m.role as "user" | "assistant", content: m.content })),
      );
    });
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [timeline]);

  const { send } = useConversationSocket(conversationId, (event) => {
    onEvent(event);
    handleEvent(event);
  });

  function handleEvent(event: BrainEvent) {
    switch (event.type) {
      case "text_delta": {
        setTimeline((prev) => {
          if (streamingIdRef.current) {
            return prev.map((item) =>
              item.kind === "message" && item.id === streamingIdRef.current
                ? { ...item, content: item.content + event.text }
                : item,
            );
          }
          const id = `streaming-${Date.now()}`;
          streamingIdRef.current = id;
          return [...prev, { kind: "message", id, role: "assistant", content: event.text, streaming: true }];
        });
        break;
      }
      case "tool_started": {
        setTimeline((prev) => [
          ...prev,
          {
            kind: "activity",
            id: `activity-${event.toolName}-${Date.now()}`,
            entry: { id: event.toolName, toolName: event.toolName, input: event.input, status: "running" },
          },
        ]);
        break;
      }
      case "tool_awaiting_approval":
        updateLastActivity(event.toolName, { status: "awaiting_approval" });
        break;
      case "tool_result":
        updateLastActivity(event.toolName, {
          status: "success",
          output: event.output,
          verified: event.verified,
        });
        break;
      case "tool_error":
        updateLastActivity(event.toolName, { status: "error", error: event.error });
        break;
      case "message_complete":
        streamingIdRef.current = null;
        setSending(false);
        break;
      case "error":
        setSending(false);
        break;
      default:
        break;
    }
  }

  function updateLastActivity(toolName: string, patch: Partial<ActivityEntry>) {
    setTimeline((prev) => {
      const idx = [...prev].reverse().findIndex((item) => item.kind === "activity" && item.entry.toolName === toolName);
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      const copy = [...prev];
      const item = copy[realIdx];
      if (item && item.kind === "activity") {
        copy[realIdx] = { ...item, entry: { ...item.entry, ...patch } };
      }
      return copy;
    });
  }

  function submit(text?: string) {
    const value = (text ?? draft).trim();
    if (!value || sending) return;
    setTimeline((prev) => [...prev, { kind: "message", id: `user-${Date.now()}`, role: "user", content: value }]);
    send(value);
    setDraft("");
    setSending(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <QuickActions onPrompt={(p) => setDraft(p)} onNavigate={onNavigate} />
      <div className="chat-scroll" ref={scrollRef}>
        {timeline.length === 0 && <div className="empty-state">Say something to get started.</div>}
        {timeline.map((item) =>
          item.kind === "message" ? (
            <div key={item.id} className={`message ${item.role}`}>
              {item.content || (item.streaming ? "…" : "")}
            </div>
          ) : (
            <ActivityChip key={item.id} entry={item.entry} />
          ),
        )}
      </div>
      <div className="composer">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Message Jarvis…"
          disabled={sending}
        />
        <button onClick={() => submit()} disabled={sending || !draft.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
