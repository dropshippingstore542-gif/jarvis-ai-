import { describe, expect, it } from "vitest";
import { openDatabase } from "../client.js";
import { CalendarEventRepository } from "./calendarEventRepository.js";

describe("CalendarEventRepository", () => {
  it("creates and retrieves an event", () => {
    const repo = new CalendarEventRepository(openDatabase(":memory:"));
    const event = repo.create({
      title: "Standup",
      startAt: "2026-08-14T09:00:00.000Z",
      endAt: "2026-08-14T09:15:00.000Z",
      location: "Zoom",
    });
    expect(repo.get(event.id)).toMatchObject({ title: "Standup", location: "Zoom" });
  });

  it("lists only upcoming events from a given time, soonest first", () => {
    const repo = new CalendarEventRepository(openDatabase(":memory:"));
    repo.create({ title: "Past", startAt: "2020-01-01T00:00:00.000Z", endAt: "2020-01-01T01:00:00.000Z" });
    const later = repo.create({
      title: "Later",
      startAt: "2030-01-02T00:00:00.000Z",
      endAt: "2030-01-02T01:00:00.000Z",
    });
    const sooner = repo.create({
      title: "Sooner",
      startAt: "2030-01-01T00:00:00.000Z",
      endAt: "2030-01-01T01:00:00.000Z",
    });

    const upcoming = repo.listUpcoming("2025-01-01T00:00:00.000Z");
    expect(upcoming.map((e) => e.id)).toEqual([sooner.id, later.id]);
  });

  it("deletes an event", () => {
    const repo = new CalendarEventRepository(openDatabase(":memory:"));
    const event = repo.create({
      title: "Temp",
      startAt: "2030-01-01T00:00:00.000Z",
      endAt: "2030-01-01T01:00:00.000Z",
    });
    expect(repo.delete(event.id)).toBe(true);
    expect(repo.get(event.id)).toBeUndefined();
  });
});
