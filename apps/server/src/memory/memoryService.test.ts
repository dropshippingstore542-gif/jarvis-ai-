import { describe, expect, it } from "vitest";
import { openDatabase } from "../db/client.js";
import { MemoryRepository } from "../db/repositories/index.js";
import { MemoryService, MemoryPolicyError } from "./memoryService.js";

function setup() {
  const db = openDatabase(":memory:");
  const repo = new MemoryRepository(db);
  return new MemoryService(repo);
}

describe("MemoryService", () => {
  it("stores explicit memories as confirmed immediately", () => {
    const service = setup();
    const record = service.remember({ content: "I prefer concise answers." });
    expect(record.status).toBe("confirmed");
    expect(record.source).toBe("user_explicit");
    expect(service.recall("concise")).toHaveLength(1);
  });

  it("stores inferred memories as proposed, hidden from recall until confirmed", () => {
    const service = setup();
    const record = service.remember({ content: "User seems to work in e-commerce.", source: "inferred" });
    expect(record.status).toBe("proposed");
    expect(service.recall("e-commerce")).toHaveLength(0);

    service.confirm(record.id);
    expect(service.recall("e-commerce")).toHaveLength(1);
  });

  it("rejects content that is too short or too long", () => {
    const service = setup();
    expect(() => service.remember({ content: "ab" })).toThrow(MemoryPolicyError);
    expect(() => service.remember({ content: "x".repeat(2001) })).toThrow(MemoryPolicyError);
  });

  it("forgets a memory by id", () => {
    const service = setup();
    const record = service.remember({ content: "Forget me please." });
    expect(service.forget(record.id)).toBe(true);
    expect(service.list()).toHaveLength(0);
  });

  it("forgetMatching removes every memory containing the query", () => {
    const service = setup();
    service.remember({ content: "The supplier email is a@example.com." });
    service.remember({ content: "The supplier phone is 555-1234." });
    service.remember({ content: "Unrelated fact about weather." });

    expect(service.forgetMatching("supplier")).toBe(2);
    expect(service.list()).toHaveLength(1);
  });
});
