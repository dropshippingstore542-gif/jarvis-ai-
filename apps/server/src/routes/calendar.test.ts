import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerCalendarRoutes } from "./calendar.js";
import { openDatabase } from "../db/client.js";
import { createRepositories } from "../db/repositories/index.js";
import type { AppContext } from "../context.js";

function buildTestApp() {
  const db = openDatabase(":memory:");
  const repos = createRepositories(db);
  const ctx = { repos } as unknown as AppContext;
  const app = Fastify();
  registerCalendarRoutes(app, ctx);
  return { app, repos };
}

describe("GET /api/calendar.ics", () => {
  it("serves a real iCalendar feed reflecting stored events", async () => {
    const { app, repos } = buildTestApp();
    repos.calendarEvents.create({
      title: "Supplier call",
      startAt: "2030-06-01T15:00:00.000Z",
      endAt: "2030-06-01T15:30:00.000Z",
    });

    const res = await app.inject({ method: "GET", url: "/api/calendar.ics" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/calendar");
    expect(res.body).toContain("BEGIN:VCALENDAR");
    expect(res.body).toContain("SUMMARY:Supplier call");
    expect(res.body).toContain("DTSTART:20300601T150000Z");
  });

  it("returns an empty-but-valid calendar when there are no events", async () => {
    const { app } = buildTestApp();
    const res = await app.inject({ method: "GET", url: "/api/calendar.ics" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("BEGIN:VCALENDAR");
    expect(res.body).not.toContain("BEGIN:VEVENT");
  });
});
