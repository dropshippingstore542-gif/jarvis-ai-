import type { WebSocket } from "ws";

/** Fan-out for per-conversation WebSocket streams (assistant text, tool activity, status, approvals). */
export class WsHub {
  private conns = new Map<string, Set<WebSocket>>();

  subscribe(conversationId: string, socket: WebSocket): void {
    let set = this.conns.get(conversationId);
    if (!set) {
      set = new Set();
      this.conns.set(conversationId, set);
    }
    set.add(socket);
    socket.on("close", () => set?.delete(socket));
  }

  broadcast(conversationId: string, event: unknown): void {
    const set = this.conns.get(conversationId);
    if (!set) return;
    const payload = JSON.stringify(event);
    for (const socket of set) {
      if (socket.readyState === socket.OPEN) socket.send(payload);
    }
  }
}
