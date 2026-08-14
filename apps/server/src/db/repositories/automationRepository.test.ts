import { describe, expect, it } from "vitest";
import { openDatabase } from "../client.js";
import { AutomationRepository } from "./automationRepository.js";
import { AutomationRunRepository } from "./automationRunRepository.js";

describe("AutomationRepository", () => {
  it("deletes an automation that has run history without violating the foreign key", () => {
    const db = openDatabase(":memory:");
    const automations = new AutomationRepository(db);
    const runs = new AutomationRunRepository(db);

    const automation = automations.create({
      name: "Has history",
      cronExpression: "0 8 * * *",
      prompt: "Do something.",
      nextRunAt: new Date().toISOString(),
    });
    const run = runs.start(automation.id);
    runs.finish(run.id, "success", "done");

    expect(() => automations.delete(automation.id)).not.toThrow();
    expect(automations.get(automation.id)).toBeUndefined();
    expect(runs.listByAutomation(automation.id)).toHaveLength(0);
  });

  it("listDue only returns enabled automations whose next_run_at has arrived", () => {
    const db = openDatabase(":memory:");
    const automations = new AutomationRepository(db);
    const now = new Date();
    const past = new Date(now.getTime() - 60_000).toISOString();
    const future = new Date(now.getTime() + 60_000).toISOString();

    const due = automations.create({ name: "Due", cronExpression: "* * * * *", prompt: "x", nextRunAt: past });
    automations.create({ name: "Not due", cronExpression: "* * * * *", prompt: "x", nextRunAt: future });
    const disabled = automations.create({ name: "Disabled", cronExpression: "* * * * *", prompt: "x", nextRunAt: past });
    automations.setEnabled(disabled.id, false);

    const result = automations.listDue(now.toISOString());
    expect(result.map((a) => a.id)).toEqual([due.id]);
  });
});
