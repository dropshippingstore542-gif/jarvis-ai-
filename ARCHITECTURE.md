# Architecture

## Overview

```
Me → Text or Voice → AI Brain → Memory + Tools + Vision → Action → Text or Voice Response
```

Jarvis is a TypeScript monorepo: a Node/Fastify backend holds all state and
intelligence (the "brain"), a React frontend is a thin client over its
REST + WebSocket API. Every capability — memory, filesystem access, web
search, browser control, vision — is a **tool**, registered in one place,
selected dynamically by the model, and gated by a permission engine.
Nothing is hard-coded to one AI provider or one database engine.

```
Jarvis
│
├── Core Brain           apps/server/src/brain        (implemented)
├── Conversation Engine   apps/server/src/db + routes  (implemented)
├── Memory System          apps/server/src/memory       (implemented)
├── Tool System            packages/core/src/tools      (implemented)
├── Browser Control        apps/server/src/browser       (implemented — Playwright)
├── Vision                 browser.screenshot / vision.describe_image (implemented — real multi-modal messages)
├── Voice                  packages/core/src/voice + routes/voice.ts  (implemented — push-to-talk, real STT/TTS)
├── Automation Engine      apps/server/src/automation    (implemented — cron scheduler)
├── Security / Permissions apps/server/src/permissions  (implemented)
├── Plugin System           apps/server/src/plugins      (implemented — loader mechanism)
├── User Interface          apps/web                     (implemented)
├── Computer Control                                     (partial — file management real, OS-level not — see below)
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
(`thinking|working|waiting_for_approval|idle`, plus `speaking` — genuinely
used while a synthesized voice reply plays back, see "Voice" below;
`listening` is reserved for a future continuous-mic mode, unused by
push-to-talk), tool start/result/error, and text deltas. This is the
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
| `filesystem.mkdir` / `.move` | low | create/organize files — see "Computer control" below |
| `filesystem.delete` | **high** | irreversible — spec's own HIGH RISK example, requires typed CONFIRM |
| `web.search` | safe | pluggable Brave/SerpAPI; reports "not configured" rather than faking results |
| `browser.open` | low | real headless Chromium via Playwright — see "Browser automation" below |
| `browser.click` / `browser.type` | medium | act on the page opened by `browser.open` in the same conversation |
| `browser.screenshot` | safe | real screenshot of the open page — see "Vision" below |
| `vision.describe_image` | safe | reads a real image file from the workspace — see "Vision" below |

**Registered but not implemented** (`stubTools.ts`) — calling one throws a
`ToolNotImplementedError` naming exactly what's missing, so the model and
the user both see a clear failure, never a fabricated result:

| Tool | What's needed to finish it |
|---|---|
| `computer.take_screenshot` | OS-level (not browser-page) screen capture — unavailable in a server-only environment; `browser.screenshot` covers the web-content case |
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

## Vision

Real, not faked: the model genuinely sees image bytes, not a text
description of them. `packages/core/src/llm/types.ts`'s `ChatMessage` has an
optional `images?: ImageAttachment[]` (real `{mimeType, base64}` bytes).
Any tool can produce one — the convention (`packages/core/src/tools/
toolImageOutput.ts`) is just an `image` field shaped like that on the tool's
output. The orchestrator (`brain/orchestrator.ts`) checks every successful
tool result for this field and, when present, attaches the image to that
tool-result `ChatMessage` and strips the base64 out of the JSON text
version (so it isn't duplicated) — see `orchestrator.test.ts`, which proves
an image survives from a tool call into the *next* model turn.

Two tools produce images today:

- **`browser.screenshot`** — a real Playwright screenshot (PNG) of the
  currently open page. Answers the spec's own example ("look at this
  screenshot and tell me why this website is broken") for web content.
- **`vision.describe_image`** — reads a real image file
  (png/jpg/jpeg/gif/webp) from the sandboxed workspace directory and
  attaches its exact bytes. Use it by dropping a screenshot/photo/document
  into the workspace and asking about it.

Each provider represents an image differently, per its own API's rules
(`AnthropicProvider`/`OpenAIProvider`, tested in
`*Provider.test.ts`): Anthropic supports images directly inside a
`tool_result` content block, so the image rides along with that turn.
OpenAI's tool-result message schema is text-only, so `OpenAIProvider`
keeps the tool message as text and injects one synthetic `user` message
right after it carrying the image — the model still sees it on the same
turn, just via a different message shape. `LocalProvider` inherits
whatever the local model actually supports; a model with no vision
capability will just not act on the image, not silently break.

Full-fidelity image bytes are persisted (`messages.images` column,
`MessageRepository`) so a screenshot the model saw two turns ago is still
visible to it now, not just for the one turn it arrived on. The frontend's
`ActivityChip` renders a thumbnail inline when a tool result carries an
image, so you can see exactly what the model saw.

**What this isn't**: OS-level screen capture (arbitrary desktop
screenshots) — see "Computer control" below.

## Voice

Real speech-to-text and text-to-speech, real browser microphone capture —
push-to-talk, not the spec's continuous wake-word listening (see "What
isn't built" below for exactly why and what that would take).

`packages/core/src/voice/`: `STTProvider`/`TTSProvider` interfaces mirror
`LLMProvider`'s shape. `OpenAISTTProvider` calls the real Whisper
transcription endpoint (multipart upload); `OpenAITTSProvider` calls the
real speech endpoint and returns real audio bytes — both are genuine HTTP
clients (tested against a mocked `fetch`, `OpenAI*Provider.test.ts`), not
stubs. Configured via `STT_PROVIDER`/`TTS_PROVIDER`/`VOICE_API_KEY`;
`createSTTProvider("none", …)`/`createTTSProvider("none", …)` throw a
`VoiceConfigError` rather than returning fake audio/text.

Flow (`POST /api/conversations/:id/voice-message`,
`apps/server/src/routes/voice.ts`):

```
browser mic (MediaRecorder)  →  base64 audio  →  STT (real transcript)
     →  the SAME Orchestrator.handleUserMessage() a typed message uses
     →  final text  →  TTS (real audio)  →  played back in the browser
```

`context.ts` constructs `sttProvider`/`ttsProvider` once at boot (same
pattern as the LLM provider) and leaves them `undefined` when
unconfigured; the route checks for that and returns a clear 400 rather than
attempting a call — see `routes/voice.test.ts`, which covers the
unconfigured path, a successful transcribe→respond→synthesize round trip
(with fake providers, since this environment can't reach OpenAI), the
transcription-failure path (502, not a fabricated transcript), and the
TTS-unconfigured-but-STT-fine path (still returns the text reply).

`apps/web/src/lib/useVoiceRecorder.ts` + `VoiceButton.tsx`: a real
`navigator.mediaDevices.getUserMedia`/`MediaRecorder`-based push-to-talk
button — press-and-hold records, release sends. This runs in the *user's*
browser, wherever they open the web UI, so it has real mic/speaker access
regardless of what this development container has.

**What isn't built**: a continuous "always listening for the wake word"
loop. That needs a streaming audio pipeline plus a wake-word detection
model (e.g. Porcupine/openWakeWord) running client-side before anything is
sent to the server — a materially bigger feature than push-to-talk, which
the spec itself lists as an acceptable fallback (§5). `WAKE_WORD` is
stored and shown in Settings for when that's built; today nothing acts on
it. `AssistantStatus.listening` is reserved the same way; `speaking` is
genuinely used today, driven by TTS playback in the browser.

## Computer control

Partially real, split honestly by what a headless container can and can't
do:

- **File management** — real and sandboxed: `filesystem.mkdir` (low),
  `filesystem.move` (low, refuses to silently overwrite an existing
  destination), `filesystem.delete` (**high** — matches the spec's own
  "delete files" HIGH RISK example exactly, requires the typed-CONFIRM
  approval flow). Together with the pre-existing `read`/`write`/`list`,
  this covers the spec's "create folders, rename files, move files,
  organize files" bucket in full.
- **Browser-based "open/navigate/click/type"** — real, see "Browser
  automation" above.
- **OS-level app launching, arbitrary desktop screenshots, input
  injection** — still `computer.open_app`/`computer.take_screenshot` stubs.
  This is not a missing-code problem: a headless Linux server container has
  no display server and no desktop session, so "launch an app the user can
  see" or "screenshot the whole desktop" has nothing to act on here. It
  needs a companion process running on the user's actual desktop (or the
  Tauri packaging described below) — genuinely a different deployment
  shape, not an oversight fixable by more server code.

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
audit log, approvals, settings, automations, voice. One WebSocket per
conversation (`/ws/conversations/:id`) streams `BrainEvent`s live; `POST
/conversations/:id/messages` is a buffered non-streaming fallback (useful
for scripts/tests, and matches spec §5's "text-only fallback" requirement
even when voice is configured). `POST /conversations/:id/voice-message` is
the voice equivalent — see "Voice" above.

## Frontend

`apps/web`: React + Vite + TypeScript, hand-rolled dark theme (no UI kit) —
conversation view with streaming text and inline tool-activity chips
(including a rendered thumbnail when a tool result carries a real image —
see "Vision"), a status badge, quick actions, a push-to-talk voice button,
a memory manager (search/remember/confirm/delete/clear), an audit log
viewer, an Automations panel (create/enable/disable/run-now/delete/history),
and an approval modal (plus a distinct high-risk variant). Settings panel
shows the effective AI/voice/proactive config (env-driven, restart to
change) and every registered tool with its permission level.

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
rather than a button that pretends to work. (Voice, vision, and browser
control used to be listed here — see the sections above; they're
implemented now, not merely stubbed.)

- **Continuous wake-word listening**: see "Voice" above — push-to-talk is
  built and real; the always-on mic/wake-word loop is the piece that isn't.
- **OS-level computer control** (arbitrary app launching, whole-desktop
  screenshots, input injection): see "Computer control" above — needs a
  companion process with real desktop access, which a headless container
  fundamentally doesn't have.
- **Proactive notifications**: the automation engine is real and
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
When OS-level features (whole-desktop screenshots, launching arbitrary
apps — see "Computer control" above) are implemented, wrapping this same
web frontend in **Tauri** is the intended path — smaller and
better-sandboxed than Electron, and the Rust toolchain this decision
depends on is already available in this environment.
