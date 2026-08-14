# Development

## Requirements

Node.js 20+. No other runtime is required for V1 (Python/Rust are only
relevant to future phases — see ARCHITECTURE.md).

## Setup

```bash
npm install
cp .env.example .env    # set AI_API_KEY at minimum
```

## Running

```bash
npm run dev          # server (127.0.0.1:4317) + web (localhost:5173) together
npm run dev:server    # server only
npm run dev:web       # web only
```

## Building

```bash
npm run build          # builds packages/core, apps/server, apps/web
npm run typecheck      # tsc --noEmit across every workspace
npm run test           # vitest across every workspace
```

Plugins are built separately (they're not part of the default `build`
target since they're optional): `npm run build --workspace=@jarvis/plugin-example`.

## Project structure

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full module map. In short:
`packages/core` has no Node-specific runtime dependencies beyond the LLM
SDKs and is shared between the server and (in principle) any future
runtime; `apps/server` is where all state and business logic live;
`apps/web` is a thin client.

## Adding a built-in tool

1. Add a file under `apps/server/src/tools/builtins/`. A tool is a plain
   object matching `Tool<I, O>` from `@jarvis/core`:

   ```ts
   import { z } from "zod";
   import type { Tool } from "@jarvis/core";

   export const myTool: Tool<{ foo: string }, { bar: string }> = {
     name: "my.tool",
     description: "...",
     inputSchema: z.object({ foo: z.string() }),
     outputSchema: z.object({ bar: z.string() }),
     permission: "safe", // safe | low | medium | high — see SECURITY.md
     async execute(input, ctx) {
       return { bar: input.foo.toUpperCase() };
     },
   };
   ```

2. Register it in `apps/server/src/tools/registerBuiltins.ts`.
3. Write a test next to it (`my.tool.test.ts`) — at minimum, exercise the
   happy path and one failure path.
4. If it needs credentials, add the env var to `.env.example` and
   `apps/server/src/config.ts`, and document it in CONFIGURATION.md.

Don't reach for a `medium`/`high` permission unless the action is genuinely
destructive or irreversible/costly — see SECURITY.md's tier table.

For a capability that belongs outside the core repo (a third-party
integration, something optional), write it as a **plugin** instead — see
PLUGIN_DEVELOPMENT.md.

### Making a tool the model can actually see the output of (vision)

Any tool can return a real image, not just `browser.screenshot`/
`vision.describe_image`. Include a field literally named `image` shaped
like `{ mimeType: string; base64: string }` in your output (declare it in
`outputSchema` too):

```ts
outputSchema: z.object({
  /* ...your other fields... */
  image: z.object({ mimeType: z.string(), base64: z.string() }),
}),
```

The orchestrator (`brain/orchestrator.ts`) automatically detects that field
(`extractImageAttachment` from `@jarvis/core`), attaches the real bytes to
the tool-result message as a genuine multi-modal attachment, and strips the
base64 out of the JSON text version so it isn't duplicated. No other wiring
needed — see ARCHITECTURE.md's "Vision" section for how each provider
represents that differently, and `orchestrator.test.ts` for a worked
example asserting the image survives into the next model turn.

## Testing

Vitest, run per-package (`npm run test --workspace=@jarvis/server`) or all
at once (`npm run test`). Conventions used so far:

- Pure logic (memory policy, permission gating, path-traversal rejection,
  audit-row-per-execution) is unit tested against an in-memory SQLite DB
  (`openDatabase(":memory:")`) — fast, no fixtures to clean up.
- LLM providers are tested at the factory/config-validation level
  (`packages/core/src/llm/factory.test.ts`), not against a live API — there
  is no mock HTTP layer for the streaming SDKs yet. If you add real
  request/response assertions, mock the SDK client, not the network.
- Browser tools (`browserTools.test.ts`) run against a **real** headless
  Chromium via Playwright, pointed at a throwaway `http:` server started in
  the test itself — no live network dependency, no snapshot fakery. Needs a
  Chromium binary; set `PLAYWRIGHT_CHROMIUM_PATH` if yours isn't at the
  default `/opt/pw-browsers/chromium`, or run `npx playwright install
  chromium` if you don't have one. `urlSafety.test.ts` only uses IP
  literals, deliberately avoiding a DNS dependency.
- The scheduler (`scheduler.test.ts`) is tested against a fake
  `OrchestratorLike` (just an async generator you control), not a real
  LLM — this is what lets the overlapping-tick idempotency test assert
  "exactly one execution" deterministically instead of racing a timer.
- `orchestrator.test.ts` uses the same scripted-`LLMProvider` pattern: a
  fake provider that returns a queued list of `ChatStreamEvent[]` per call,
  so you can assert precisely what messages the *second* model turn
  received (e.g. that a tool's image made it in) without any network
  dependency. Reuse this pattern for orchestrator-level assertions rather
  than mocking `fetch` at the SDK layer.
- Vision tools (`browserTools.test.ts`'s screenshot case,
  `visionTools.test.ts`) assert against real bytes — a real PNG signature
  read back from a real screenshot, a real 1×1 PNG fixture round-tripped
  byte-for-byte through `vision.describe_image` — not mocked image data.
- Voice providers (`OpenAITTSProvider.test.ts`, `OpenAISTTProvider.test.ts`)
  mock `fetch` with `vi.stubGlobal` (remember `vi.unstubAllGlobals()` in
  `afterEach`) and assert the *request* shape (URL, auth header, multipart
  form fields) as much as the response parsing — these are real HTTP
  clients, so the request shape is exactly what would hit OpenAI's API.
  `routes/voice.test.ts` injects fake `STTProvider`/`TTSProvider` objects
  into a hand-built `AppContext` (see `context.ts`'s `sttProvider`/
  `ttsProvider` fields) rather than fighting `config.ts`'s env-var
  singleton — much simpler than resetting modules mid-test.

## Automations

An automation is a cron expression (`0 8 * * *`, evaluated in the server's
local timezone) plus a prompt string sent through the same orchestrator a
chat message goes through — same memory, tools, and permission checks
apply. `Scheduler` (`apps/server/src/automation/scheduler.ts`) polls every
30s by default; pass a shorter `tickIntervalMs` in tests. See
ARCHITECTURE.md's "Automation engine & scheduler" section for the
idempotency/restart-survival design, and SECURITY.md for why a `medium`/
`high` tool call inside an unattended automation just times out rather than
auto-approving.

## Database

SQLite file at `DATABASE_URL` (default `./data/jarvis.sqlite`), created and
migrated automatically on first run (`apps/server/src/db/client.ts`). No
separate migration tool — schema changes are additive `CREATE TABLE IF NOT
EXISTS`/`ALTER TABLE` statements in that file. Delete the file to reset all
state during development.

## Workspace directory

`filesystem.*` tools only ever touch `JARVIS_WORKSPACE_DIR` (default
`./workspace`, created on demand). Point it at a scratch directory during
development, not anywhere with files you care about, until you've read
SECURITY.md's sandboxing notes.
