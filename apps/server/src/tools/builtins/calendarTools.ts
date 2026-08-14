import { z } from "zod";
import type { Tool } from "@jarvis/core";
import type { CalendarEventRepository } from "../../db/repositories/index.js";

const eventOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  startAt: z.string(),
  endAt: z.string(),
});

export interface CalendarTools {
  createEvent: Tool<
    { title: string; startAt: string; endAt: string; description?: string; location?: string },
    z.infer<typeof eventOutputSchema>
  >;
  listEvents: Tool<{ from?: string }, { events: z.infer<typeof eventOutputSchema>[] }>;
}

/**
 * Local-first calendar — no Google/Outlook OAuth needed. Events are stored
 * in SQLite and published as a real RFC 5545 feed (GET /api/calendar.ics,
 * see routes/calendar.ts) that any calendar app can subscribe to. That's
 * genuine interoperability, not a simulation of one.
 */
export function createCalendarTools(events: CalendarEventRepository): CalendarTools {
  const createEvent: CalendarTools["createEvent"] = {
    name: "calendar.create_event",
    description:
      "Create a calendar event. It's stored locally and appears in the /api/calendar.ics feed — " +
      "subscribe to that URL from Google/Apple/Outlook calendar to see it there too.",
    inputSchema: z.object({
      title: z.string().min(1),
      startAt: z.string().datetime(),
      endAt: z.string().datetime(),
      description: z.string().optional(),
      location: z.string().optional(),
    }),
    outputSchema: eventOutputSchema,
    permission: "low",
    async execute(input) {
      return events.create(input);
    },
  };

  const listEvents: CalendarTools["listEvents"] = {
    name: "calendar.list_events",
    description: "List upcoming calendar events, soonest first.",
    inputSchema: z.object({ from: z.string().datetime().optional() }),
    outputSchema: z.object({ events: z.array(eventOutputSchema) }),
    permission: "safe",
    async execute(input) {
      const from = input.from ?? new Date().toISOString();
      return { events: events.listUpcoming(from) };
    },
  };

  return { createEvent, listEvents };
}
