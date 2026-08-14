import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { config } from "../config.js";
import { generateIcsCalendar } from "../calendar/ics.js";

/**
 * A real, subscribable iCalendar feed — paste this URL into Google/Apple/
 * Outlook calendar's "subscribe by URL" and events created via
 * calendar.create_event show up there too.
 *
 * Calendar apps fetch this server-to-server on a poll interval and
 * generally can't send a custom Authorization header, so when
 * API_AUTH_TOKEN is set this route is exempted from the usual bearer-auth
 * hook (see app.ts) and instead accepts the token as a `?token=` query
 * param — the same "long secret in the URL" pattern real calendar
 * providers use for private feed links, not a weaker check.
 */
export function registerCalendarRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/calendar.ics", async (req, reply) => {
    if (config.server.authToken) {
      const { token } = z.object({ token: z.string().optional() }).parse(req.query);
      if (token !== config.server.authToken) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    }

    const events = ctx.repos.calendarEvents.list();
    reply.header("Content-Type", "text/calendar; charset=utf-8");
    reply.header("Content-Disposition", 'inline; filename="jarvis.ics"');
    return generateIcsCalendar(events);
  });
}
