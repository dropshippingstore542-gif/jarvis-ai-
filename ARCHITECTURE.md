# Architecture

## Overview

```
Me → Text (Voice: Phase 5) → AI Brain → Memory + Tools + Computer → Action → Text (Voice: Phase 5) Response
```

Jarvis is a TypeScript monorepo: a Node/Fastify backend holds all state and
intelligence (the "brain"), a React frontend is a thin client over its
REST + WebSocket API. Every capability — memory, filesystem access, web
search, future browser/computer control — is a **tool**, registered in one
place, selected dynamically by the model, and gated by a permission engine.
Nothing is hard-coded to one AI provider or one database engine.

```
Jarvis
│
├── Core Brain           apps/server/src/brain        (implemented)
├── Conversation Engine   apps/server/src/db + routes  (implemented)
├── Memory System          apps/server/src/memory       (implemented)
├── Tool System            packages/core/src/tools      (implemented)
├── Security / Permissions apps/server/src/permissions  (implemented)
├── Plugin System           apps/server/src/plugins      (implemented — loader mechanism)
├── User Interface          apps/web                     (implemented)
├── Voice System                                        (interface only — see below)
├── Vision System                                        (interface only — see below)
├── Computer Control                                     (interface only — see below)
├── Browser Control                                       (interface only — see below)
├── Automation Engine                                     (types only — see below)
└── Scheduler                                              (not started — see below)
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

**Registered but not implemented** (`stubTools.ts`) — calling one throws a
`ToolNotImplementedError` naming exactly what's missing, so the model and
the user both see a clear failure, never a fabricated result:

| Tool | What's needed to finish it |
|---|---|
| `browser.open` / `browser.click` | a Playwright-backed browser automation module (see below) |
| `computer.take_screenshot` | OS-level screen capture — unavailable in a server-only environment |
| `computer.open_app` | a companion desktop process with OS process-launch permission |
| `calendar.create_event` | Google Calendar/Outlook OAuth integration |
| `email.send` | Gmail/SMTP integration with real credentials |

No shell-exec tool exists at all. Spec §19/§41 call out arbitrary shell
execution as the highest-risk capability in the whole system; it needs a
real sandboxing story (container/VM boundary, command allowlist) before it
should exist, and that's a deliberate scope decision, not an oversight.

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
- **Browser automation / computer control**: `browser.*`/`computer.*` tools
  are registered and typed; needs a Playwright-backed module (browser) and
  OS-level access (computer) neither of which exist in a server-only
  container.
- **Automation engine / scheduler**: needs durable trigger storage
  (time/event/webhook), a persistent long-running executor process, and
  idempotency handling to avoid duplicate runs. None of that exists yet;
  building it against an ephemeral request/response server would be
  building it to fail.
- **Proactive notifications**: `PROACTIVE_MODE` is stored in settings;
  needs the automation engine above plus a delivery channel (desktop
  notification, push).
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
