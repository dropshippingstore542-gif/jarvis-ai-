import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { config } from "../config.js";

const incomingSchema = z.object({ type: z.literal("user_message"), text: z.string().min(1) });

/**
 * One WS connection per conversation. The client sends {type:"user_message",
 * text}; the server streams back BrainEvent frames (status changes, text
 * deltas, tool activity, approval prompts) as the orchestrator produces
 * them — this is the live channel; POST /messages is the buffered fallback.
 */
export function registerWsRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/ws/conversations/:id", { websocket: true }, (socket, req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    ctx.repos.conversations.ensure(id);
    ctx.wsHub.subscribe(id, socket);

    socket.on("message", (raw: Buffer) => {
      void (async () => {
        let parsed: z.infer<typeof incomingSchema>;
        try {
          parsed = incomingSchema.parse(JSON.parse(raw.toString()));
        } catch {
          socket.send(JSON.stringify({ type: "error", message: "Invalid message frame." }));
          return;
        }

        try {
          for await (const event of ctx.orchestrator.handleUserMessage({
            conversationId: id,
            userId: "local-user",
            workspaceDir: config.workspaceDir,
            text: parsed.text,
            logger: ctx.logger.child({ conversationId: id }),
          })) {
            socket.send(JSON.stringify(event));
          }
        } catch (err) {
          socket.send(
            JSON.stringify({
              type: "error",
              message: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      })();
    });
  });
}
