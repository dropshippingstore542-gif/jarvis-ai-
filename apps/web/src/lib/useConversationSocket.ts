import { useCallback, useEffect, useRef } from "react";
import { WS_BASE } from "./api";
import type { BrainEvent } from "./types";

export function useConversationSocket(
  conversationId: string | null,
  onEvent: (event: BrainEvent) => void,
) {
  const socketRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!conversationId) return;
    const socket = new WebSocket(`${WS_BASE}/ws/conversations/${conversationId}`);
    socketRef.current = socket;
    socket.onmessage = (ev) => {
      try {
        onEventRef.current(JSON.parse(ev.data as string) as BrainEvent);
      } catch {
        // malformed frame — ignore
      }
    };
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [conversationId]);

  const send = useCallback((text: string) => {
    socketRef.current?.send(JSON.stringify({ type: "user_message", text }));
  }, []);

  return { send };
}
