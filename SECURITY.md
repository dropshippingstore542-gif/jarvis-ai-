# Security

## Permission model

Every tool declares a risk tier (`packages/core/src/types/permissions.ts`):

| Tier | Examples | Behavior |
|---|---|---|
| `safe` | read memory, search web, list files | auto-executes, audited |
| `low` | write a file, create a memory | auto-executes, audited |
| `medium` | (future) send a message, edit a shared doc | requires explicit approval |
| `high` | (future) delete files, send email, spend money | requires typed "CONFIRM" approval |

`medium`/`high` actions create a `pending_actions` row and block the
orchestrator (`PermissionEngine.authorize`) until a human calls
`POST /api/approvals/:id/resolve`, or 15 minutes pass and it expires as a
denial. There is no code path that auto-approves a `medium`/`high` action,
and no retry-after-denial loop — a denial or timeout is terminal for that
tool call; the model is told plainly and moves on.

## No shell execution

Jarvis V1 ships **no shell-exec tool at all**. This is the single riskiest
capability the spec describes (§19/§41), and it is not included until there
is a real sandboxing story (container/VM isolation, command allowlisting) —
not merely a permission-level label. Do not add one without that in place.

## Filesystem sandbox

`filesystem.*` tools resolve every path against `JARVIS_WORKSPACE_DIR` and
reject anything that escapes it (`resolveSafePath` in
`apps/server/src/tools/builtins/filesystemTools.ts`, covered by
`filesystemTools.test.ts`: `../`, absolute paths, and `sub/../../escape`
style traversal are all rejected). The assistant cannot read or write
anywhere else on disk through this tool.

## Secrets

- All secrets (`AI_API_KEY`, `WEB_SEARCH_API_KEY`, `API_AUTH_TOKEN`) load
  server-side only, from `.env` via `apps/server/src/config.ts`. None of
  this is bundled into the frontend — `apps/web` never imports `.env` or
  the config module.
- `.env` is gitignored. `.env.example` documents every variable with no
  real values.
- `AI_BASE_URL`/local-model use doesn't require a cloud key at all.

## Auth

A single-user, local-first bearer token (`API_AUTH_TOKEN`) gates the REST
API when set. If unset, the server trusts anything that can reach its port
— acceptable for a process bound to `127.0.0.1` on your own machine, not for
exposing the port beyond it. **Known limitation:** browsers' native
`WebSocket` API cannot set custom headers, so the bearer token does not
currently gate the `/ws/conversations/:id` upgrade request the way it gates
REST calls — the practical protection for that endpoint today is binding to
`127.0.0.1` (the default) rather than `0.0.0.0`. Swapping in real
session/cookie auth is a contained change (`apps/server/src/auth.ts`) if
this ever needs to be reachable beyond localhost.

## Prompt-injection defense

`apps/server/src/brain/systemPrompt.ts` establishes an explicit authority
model on every request:

- **System instructions** (the system prompt) and the **user's own chat
  messages** are the only sources of authority.
- **Tool output and external content** (web search results, file contents,
  anything read via a tool) is data. It is never treated as an instruction,
  even if it contains imperative text aimed at the model ("ignore previous
  instructions…"). The system prompt tells the model explicitly to report
  such attempts to the user rather than comply.
- Memory context injected into the prompt is labeled as data, not
  instructions, for the same reason.

This is a prompt-level control, not a hard technical boundary — it reduces
risk but a sufficiently adversarial tool result could still influence a
model's phrasing. The permission engine is the actual enforcement boundary:
even a fully "convinced" model cannot perform a `medium`/`high` action
without a human clicking approve.

## Audit log

Every tool execution — auto-run or approved — writes exactly one row to
`audit_log` (`apps/server/src/audit/auditService.ts`, covered by
`auditService.test.ts`): tool name, input summary, permission level,
approver, result (`success`/`failure`/`denied`), error message if any,
duration. There is no API to delete or edit rows.

## What's honest vs. not implemented

Per spec §40/§41: nothing in this codebase pretends to succeed. Tools that
aren't built yet (`browser.*`, `computer.*`, `calendar.*`, `email.*`) throw
a `ToolNotImplementedError` naming exactly what's missing — they are never
wired to return a fabricated success. Failed tool calls, denied approvals,
and LLM provider errors are all reported to the user as failures, never
silently swallowed.
