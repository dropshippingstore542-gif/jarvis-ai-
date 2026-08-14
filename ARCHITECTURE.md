# Architecture

## Overview

```
Me → Text (Voice: Phase 5) → AI Brain → Memory + Tools + Computer → Action → Text (Voice: Phase 5) Response
```

Jarvis is a TypeScript monorepo: a Node/Fastify backend holds all state and
intelligence (the "brain"), a React frontend is a thin client over its
REST + WebSocket API. Every capability — memory, filesystem access, web
search, browser control — is a **tool**, registered in one place, selected
dynamically by the model, and gated by a permission engine. Nothing is
hard-coded to one AI provider or one database engine.

```
Jarvis
│
├── Core Brain           apps/server/src/brain        (implemented)
├── Conversation Engine   apps/server/src/db + routes  (implemented)
├── Memory System          apps/server/src/memory       (implemented)
├── Tool System            packages/core/src/tools      (implemented)
├── Browser Control        apps/server/src/browser       (implemented — Playwright)
├── Automation Engine      apps/server/src/automation    (implemented — cron scheduler)
├── Security / Permissions apps/server/src/permissions  (implemented)
├── Plugin System           apps/server/src/plugins      (implemented — loader mechanism)
├── User Interface          apps/web                     (implemented)
├── Voice System                                        (interface only — see below)
├── Vision System                                        (interface only — see below)
├── Computer Control                                     (interface only — see below)
└── Proactive Notifications                              (partial — see below)
```

## Request flow

```
USER MESSAGE
     ↓
Orchestrator.handleUserMessage()      apps/server/src/brain/orchestrator.ts
     ↓
MEMORY RETRIEVAL      confirmed long-term memories relevant to the message (keyword search)
     ↓
LLM call with tool specs      the model performs intent detection + tool selection
     ↓                        natively via tool-use — see "Intent detection" below
TOOL CALL(S) REQUESTED?  — no → stream final answer, done
     ↓ yes
PERMISSION CHECK      safe/low auto-run; medium/high create a pending_action and block
     ↓
EXECUTION      tool.execute() inside a ToolContext jailed to the workspace dir
     ↓
VERIFICATION      tool.verify() when the tool defines one (e.g. filesystem.write re-reads the file)
     ↓
AUDIT LOG      exactly one row per execution — success, failure, or denied
     ↓
result fed back to the model → loop (bounded to 6 iterations) → final response
```

Every step emits a structured `BrainEvent` (`apps/server/src/brain/trace.ts`)
over the conversation's WebSocket: status changes
(`thinking|working|waiting_for_approval|idle`, plus `listening|speaking`
reserved for Phase 5), tool start/result/error, and text deltas. This is the
observability panel data (spec §36) — tool name, arguments, result, timing —
deliberately never the model's internal reasoning.

### Intent detection

The spec describes intent detection as a distinct pipeline stage. In this
implementation it is **not a separate classifier call** — the model performs
intent detection and tool selection in one pass via native tool-use
(Anthropic tool blocks / OpenAI function calling), which is the standard,
lower-latency approach today. `packages/core/src/llm/types.ts` still models
this as a distinct concern (`ChatStreamEvent` separates `text_delta` from
`tool_call`), so a dedicated pre-classification stage could be inserted later
without changing the provider interface.

## AI provider abstraction

`packages/core/src/llm/`: `LLMProvider` is a single interface
(`chat(params): AsyncGenerator<ChatStreamEvent>`) implemented by
`AnthropicProvider`, `OpenAIProvider`, and `LocalProvider` (any
OpenAI-compatible endpoint — Ollama, LM Studio, vLLM). Selected via
`AI_PROVIDER`/`AI_MODEL`/`AI_API_KEY`/`AI_BASE_URL`. No provider-specific
code exists outside this directory — the orchestrator only depends on the
interface.

## Tool system

`packages/core/src/tools/Tool.ts` defines the contract every capability
implements: `name`, `description`, Zod `inputSchema`/`outputSchema`,
`permission` (`safe|low|medium|high`), `execute()`, optional `verify()`.
`ToolRegistry` holds every tool, built-in or plugin-provided; the brain
never knows where a tool came from. `toToolSpec()` converts a tool's Zod
schema to the JSON Schema shape both LLM providers expect.

**Implemented, fully functional tools** (`apps/server/src/tools/builtins/`):

| Tool | Permission | Notes |
|---|---|---|
| `memory.remember` / `.recall` / `.list` / `.forget` | safe/low | backed by SQLite |
| `filesystem.read` / `.write` / `.list` | safe/low | hard-jailed to `JARVIS_WORKSPACE_DIR`, path-traversal rejected |
| `web.search` | safe | pluggable Brave/SerpAPI; reports "not configured" rather than faking results |
| `browser.open` | low | real headless Chromium via Playwright — see "Browser automation" below |
| `browser.click` / `browser.type` | medium | act on the page opened by `browser.open` in the same conversation |

**Registered but not implemented** (`stubTools.ts`) — calling one throws a
`ToolNotImplementedError` naming exactly what's missing, so the model and
the user both see a clear failure, never a fabricated result:

| Tool | What's needed to finish it |
|---|---|
| `computer.take_screenshot` | OS-level screen capture — unavailable in a server-only environment |
| `computer.open_app` | a companion desktop process with OS process-launch permission |
| `calendar.create_event` | Google Calendar/Outlook OAuth integration |
| `email.send` | Gmail/SMTP integration with real credentials |

No shell-exec tool exists at all. Spec §19/§41 call out arbitrary shell
execution as the highest-risk capability in the whole system; it needs a
real sandboxing story (container/VM boundary, command allowlist) before it
should exist, and that's a deliberate scope decision, not an oversight.

## Browser automation

`apps/server/src/browser/browserManager.ts` launches one headless Chromium
process (Playwright) for the whole server and gives each conversation its
own isolated context+page, so a `browser.open` → `browser.type` →
`browser.click` sequence within one conversation acts on the same page —
idle sessions (10+ minutes unused) are closed automatically. Extraction
uses the DOM (`innerText`, `querySelectorAll('a')`), not screenshots/pixel
coordinates, per the spec's "prefer DOM/accessibility info" guidance;
visual/coordinate-based fallback control is not built.

Because this tool lets the model make the server issue arbitrary outbound
HTTP requests, `apps/server/src/browser/urlSafety.ts` enforces an SSRF
denylist before every navigation: loopback, private (`10/8`, `172.16/12`,
`192.168/16`), link-local (`169.254/16`, including the cloud-metadata
address `169.254.169.254`), and `localhost` are all blocked by default,
with hostnames resolved via DNS first so a name that merely points at an
internal address is caught too — see `urlSafety.test.ts`. Override with
`JARVIS_BROWSER_ALLOW_PRIVATE_NETWORKS=true` only if you deliberately want
the assistant reaching your internal network.

## Automation engine & scheduler

`apps/server/src/automation/`: `automations` (cron expression + a
natural-language prompt) and `automation_runs` (history) live in SQLite —
`AutomationRepository`/`AutomationRunRepository`. `Scheduler` polls every
30s (configurable) and, for each due automation, runs the *exact same*
`Orchestrator.handleUserMessage()` pipeline a chat message would — memory,
tools, permissions, and audit all apply identically to an automation-fired
task as to one you typed yourself. The result (or error) is recorded to
`automation_runs` and the automation's `last_run_status`.

This satisfies spec §17 ("scheduler must survive restarts") because
schedule state is in SQLite, not memory: on boot the scheduler just resumes
polling `next_run_at` from wherever it was left, rather than needing to
replay anything. It does **not** attempt to catch up on every run missed
while the server was down — a stale `next_run_at` in the past is treated as
"due now, once," then rescheduled forward from the current time, rather
than firing once per missed interval. That's a deliberate choice to avoid
a restart triggering a burst of backlogged automations.

**Idempotency** (spec §33 calls out testing "duplicate automation
execution" explicitly): `Scheduler.tick()`'s due-detection, in-memory
`running` guard, and `next_run_at` advance are all synchronous
(`better-sqlite3` is synchronous), so two overlapping ticks can never both
claim the same due automation — see `scheduler.test.ts`'s overlapping-tick
test. An automation still running when its next occurrence arrives is
skipped that tick and picked up as soon as the previous run finishes,
rather than stacking concurrent runs.

Reachable via `POST /api/automations` (create), `PATCH .../:id` (enable/
disable), `POST .../:id/run` (run now, bypassing the schedule), and the
Automations panel in the UI (create/enable/disable/run-now/delete/view run
history).

Only two of the spec's five trigger types are implemented: **time-based**
(cron) and **manual** (run now). **Event-based**, **webhook**, and
**application-event** triggers aren't built — each would plug into the same
`Scheduler.execute()` (or a sibling method with the same signature), just
invoked by an event handler instead of a poll loop, so adding them doesn't
change the automation data model.

## Permission engine & audit log

`apps/server/src/permissions/permissionEngine.ts`: `safe`/`low` tools
execute immediately (still audited). `medium`/`high` create a
`pending_actions` row, push a `pending_action_created` event to the
frontend, and the orchestrator `await`s a human decision — nothing executes
in between. `high` risk actions get a distinct "type CONFIRM" UI
(`ApprovalModal.tsx`), not just a click. An unanswered request expires after
15 minutes and is treated as a denial — never a silent retry.

`apps/server/src/audit/auditService.ts` writes exactly one row per tool
execution (success/failure/denied, permission level, approver, duration) to
`audit_log`; there is no delete endpoint, so it's append-only from the API's
perspective. Viewable via `GET /api/audit-log` and the Audit Log panel.

## Memory system

SQLite tables: `conversations`, `messages`, `memories`. A memory has a
`type` (fact/preference/project/task/routine/episodic), a `source`
(`user_explicit`/`inferred`), and a `status` (`confirmed`/`proposed`).
Explicit "remember that…" requests are stored `confirmed` immediately.
Anything a future inference step might propose is stored `proposed` and is
**invisible to recall** until a human confirms it — see
`apps/server/src/memory/memoryPolicy.ts`. This is the mechanism behind spec
§9/§24's "must not save everything blindly" / "never silently infer and
permanently store."

Search today is keyword substring matching
(`MemoryRepository.search`). It's defined behind the same interface a real
vector index would use, so swapping in embeddings-based semantic search
later doesn't change any caller — deliberately not pulled in now, since it's
a meaningful dependency for a feature that isn't load-bearing yet.

## Database

`apps/server/src/db/client.ts` opens a single SQLite file (`better-sqlite3`,
WAL mode) — true local-first storage, no external DB server. All access goes
through `apps/server/src/db/repositories/*`, one class per table exposing
typed methods (never raw SQL outside the repository layer). Swapping to
Postgres or another engine later means implementing the same repository
interfaces, not touching callers.

## API surface

REST (`apps/server/src/routes/`): conversations, messages, tools, memories,
audit log, approvals, settings. One WebSocket per conversation
(`/ws/conversations/:id`) streams `BrainEvent`s live; `POST
/conversations/:id/messages` is a buffered non-streaming fallback (useful
for scripts/tests, and as the "text-only fallback" spec §5 asks for even
before voice exists).

## Frontend

`apps/web`: React + Vite + TypeScript, hand-rolled dark theme (no UI kit) —
conversation view with streaming text and inline tool-activity chips, a
status badge, quick actions, a memory manager (search/remember/confirm/
delete/clear), an audit log viewer, and an approval modal (plus a distinct
high-risk variant). Settings panel shows the effective AI/voice/proactive
config (env-driven, restart to change) and every registered tool with its
permission level.

## Plugin system

`apps/server/src/plugins/loader.ts` scans `plugins/*/dist/index.js` at
startup, dynamically imports each, and registers whatever tools its default
export (`JarvisPlugin`, `packages/core/src/types/plugin.ts`) returns. A
plugin that isn't built or throws during load is logged and skipped — it
never crashes the server or silently no-ops. `plugins/example-plugin` is a
minimal reference implementation (`time.now`) proving the whole path works
end-to-end. See [PLUGIN_DEVELOPMENT.md](./PLUGIN_DEVELOPMENT.md).

## Explicitly out of scope this pass — interfaces only, not faked

Per spec §40 ("do not fake capabilities"), each of these has a clear
integration point today and a documented list of what's needed to finish it,
rather than a button that pretends to work:

- **Voice** (STT/TTS/wake word): `.env` already has `TTS_PROVIDER`,
  `STT_PROVIDER`, `WAKE_WORD`; `AssistantStatus` already includes
  `listening`/`speaking`. Needs: a provider abstraction mirroring
  `LLMProvider` for STT/TTS, and a real audio device — this server-only
  container has none.
- **Vision**: needs an image capture path (screenshot or upload) feeding a
  vision-capable model call; the LLM abstraction already supports
  multi-modal providers, just not wired to an input source yet.
- **Computer control**: `computer.*` tools are registered and typed; needs
  OS-level access (screen capture, process launch) that a server-only
  container doesn't have — see "Desktop packaging" below. (Browser
  automation, unlike this, is implemented — see above.)
- **Proactive notifications**: the automation engine above is real and
  `PROACTIVE_MODE` is stored in settings, but there's no delivery channel
  yet beyond the Automations panel's run history — an automation runs and
  its result is recorded, it just doesn't push a desktop/mobile
  notification. That needs a channel (desktop notification API, a
  service-worker push for the web UI) wired to `Scheduler.execute()`'s
  outcome.
- **Multi-agent delegation**: one orchestrator today. The `LLMProvider` /
  `Tool` interfaces are agent-agnostic, so a specialized agent is "another
  orchestrator instance with a narrower tool registry" — no interface
  changes needed when it's worth building.
- **Third-party integrations** (Gmail, Calendar, Shopify, etc.): each is a
  future plugin behind the same `Tool` interface `email.send` /
  `calendar.create_event` already stub.

## Desktop packaging

Not built this pass (Phase 1 is explicitly "core backend + chat interface").
When OS-level features (screenshots, computer control) are implemented,
wrapping this same web frontend in **Tauri** is the intended path — smaller
and better-sandboxed than Electron, and the Rust toolchain this decision
depends on is already available in this environment.
