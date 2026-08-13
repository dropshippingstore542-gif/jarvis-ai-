import { describe, expect, it } from "vitest";
import { openDatabase } from "../db/client.js";
import { AuditLogRepository } from "../db/repositories/index.js";
import { AuditService } from "./auditService.js";

function setup() {
  const db = openDatabase(":memory:");
  const repo = new AuditLogRepository(db);
  return new AuditService(repo);
}

describe("AuditService", () => {
  it("records exactly one row per successful execution", () => {
    const service = setup();
    service.recordSuccess({
      toolName: "memory.remember",
      input: { content: "x" },
      permission: "safe",
      approved: true,
      durationMs: 12,
    });
    const entries = service.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ toolName: "memory.remember", result: "success", approved: true });
  });

  it("records exactly one row per failed execution, including the error", () => {
    const service = setup();
    service.recordFailure({
      toolName: "filesystem.read",
      input: { path: "missing.txt" },
      permission: "safe",
      approved: true,
      errorMessage: "ENOENT",
      durationMs: 3,
    });
    const entries = service.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ result: "failure", errorMessage: "ENOENT" });
  });

  it("records exactly one row for a denied action, never claiming success", () => {
    const service = setup();
    service.recordDenied({
      toolName: "email.send",
      input: { to: "x@example.com" },
      permission: "high",
    });
    const entries = service.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ result: "denied", approved: false });
  });
});
