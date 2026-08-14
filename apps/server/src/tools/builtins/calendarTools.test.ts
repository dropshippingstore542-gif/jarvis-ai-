import { describe, expect, it } from "vitest";
import type { ToolContext } from "@jarvis/core";
import { openDatabase } from "../../db/client.js";
import { CalendarEventRepository } from "../../db/repositories/index.js";
import { createCalendarTools } from "./calendarTools.js";
import { rootLogger } from "../../logger.js";

const ctx: ToolContext = { conversationId: "c1", userId: "u1", workspaceDir: "/tmp", logger: rootLogger };

describe("calendar tools", () => {
  it("creates an event with low permission (local, non-destructive)", async () => {
    const repo = new CalendarEventRepository(openDatabase(":memory:"));
    const { createEvent } = createCalendarTools(repo);
    expect(createEvent.permission).toBe("low");

    const result = await createEvent.execute(
      { title: "Demo", startAt: "2030-01-01T10:00:00.000Z", endAt: "2030-01-01T11:00:00.000Z" },
      ctx,
    );
    expect(result.title).toBe("Demo");
    expect(repo.get(result.id)).toBeDefined();
  });

  it("lists upcoming events, safe/read-only", async () => {
    const repo = new CalendarEventRepository(openDatabase(":memory:"));
    const { createEvent, listEvents } = createCalendarTools(repo);
    expect(listEvents.permission).toBe("safe");

    await createEvent.execute(
      { title: "Past", startAt: "2020-01-01T00:00:00.000Z", endAt: "2020-01-01T01:00:00.000Z" },
      ctx,
    );
    await createEvent.execute(
      { title: "Future", startAt: "2030-01-01T00:00:00.000Z", endAt: "2030-01-01T01:00:00.000Z" },
      ctx,
    );

    const result = await listEvents.execute({ from: "2025-01-01T00:00:00.000Z" }, ctx);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.title).toBe("Future");
  });
});
