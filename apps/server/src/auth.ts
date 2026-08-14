import type { FastifyRequest, FastifyReply } from "fastify";
import { config } from "./config.js";

/**
 * Single-user, local-first auth: a bearer token set via API_AUTH_TOKEN.
 * If unset, the server runs open on localhost only (documented in
 * SECURITY.md as a local-dev convenience, not for exposing the port beyond
 * the machine it runs on). Swappable for real session auth later — see
 * SECURITY.md.
 */
export function checkAuth(req: FastifyRequest, reply: FastifyReply, done: () => void): void {
  if (!config.server.authToken) {
    done();
    return;
  }
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (token !== config.server.authToken) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }
  done();
}
