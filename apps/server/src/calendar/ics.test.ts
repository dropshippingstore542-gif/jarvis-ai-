import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@jarvis/core";
import { generateIcsCalendar } from "./ics.js";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt1",
    title: "Team Standup",
    startAt: "2026-08-14T09:00:00.000Z",
    endAt: "2026-08-14T09:15:00.000Z",
    createdAt: "2026-08-14T00:00:00.000Z",
    updatedAt: "2026-08-14T00:00:00.000Z",
    ...overrides,
  };
}

describe("generateIcsCalendar", () => {
  it("produces a valid RFC 5545 VCALENDAR with matching BEGIN/END pairs", () => {
    const ics = generateIcsCalendar([makeEvent()]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("UID:evt1@jarvis");
    expect(ics).toContain("DTSTART:20260814T090000Z");
    expect(ics).toContain("DTEND:20260814T091500Z");
    expect(ics).toContain("SUMMARY:Team Standup");
    // RFC 5545 requires CRLF line endings.
    expect(ics).toContain("\r\n");
  });

  it("includes optional description and location when present", () => {
    const ics = generateIcsCalendar([makeEvent({ description: "Daily sync", location: "Room 4" })]);
    expect(ics).toContain("DESCRIPTION:Daily sync");
    expect(ics).toContain("LOCATION:Room 4");
  });

  it("escapes commas, semicolons, and newlines in text fields", () => {
    const ics = generateIcsCalendar([
      makeEvent({ title: "Launch, v2; final review\nsecond line" }),
    ]);
    expect(ics).toContain("SUMMARY:Launch\\, v2\\; final review\\nsecond line");
  });

  it("emits one VEVENT per event and nothing for an empty list", () => {
    const empty = generateIcsCalendar([]);
    expect(empty).not.toContain("BEGIN:VEVENT");

    const two = generateIcsCalendar([makeEvent({ id: "a" }), makeEvent({ id: "b" })]);
    expect(two.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});
