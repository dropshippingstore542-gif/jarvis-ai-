import { describe, expect, it } from "vitest";
import { computeNextRun, validateCronExpression, InvalidCronExpressionError } from "./cron.js";

describe("cron helpers", () => {
  it("accepts a valid cron expression", () => {
    expect(() => validateCronExpression("0 8 * * *")).not.toThrow();
  });

  it("rejects an invalid cron expression", () => {
    expect(() => validateCronExpression("not a cron")).toThrow(InvalidCronExpressionError);
  });

  it("computes the next occurrence strictly after the given time", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const next = computeNextRun("0 8 * * *", from);
    expect(new Date(next).toISOString()).toBe("2026-01-01T08:00:00.000Z");
  });

  it("rolls over to the next day when the time has already passed", () => {
    const from = new Date("2026-01-01T09:00:00.000Z");
    const next = computeNextRun("0 8 * * *", from);
    expect(new Date(next).toISOString()).toBe("2026-01-02T08:00:00.000Z");
  });
});
