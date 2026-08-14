# Security

## Permission model

Every tool declares a risk tier (`packages/core/src/types/permissions.ts`):

| Tier | Examples | Behavior |
|---|---|---|
| `safe` | read memory, search web, list files, screenshot the open page, read a workspace image | auto-executes, audited |
| `low` | write a file, create a memory, open a page in the browser, mkdir/move a file | auto-executes, audited |
| `medium` | click/type in the browser, (future) edit a shared doc | requires explicit approval |
| `high` | **delete a file**, (future) send email, spend money | requires typed "CONFIRM" approval |

`filesystem.delete` is `high` deliberately — it's the spec's own worked
example of a HIGH RISK action (§11), and unlike `.move`, there's no
"refuse to clobber an existing file" guard that can make it safe by
construction. It goes through the exact same typed-CONFIRM modal as every
other high-risk action.

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

## Browser automation (SSRF guard)

`browser.open` makes the server itself issue an outbound HTTP request to
whatever URL the model asks for — the classic SSRF shape. Before every
navigation, `apps/server/src/browser/urlSafety.ts` blocks loopback
(`127.0.0.1`, `localhost`, `::1`), private ranges (`10/8`, `172.16/12`,
`192.168/16`), and link-local addresses (`169.254/16`, which includes the
`169.254.169.254` cloud instance-metadata endpoint many SSRF exploits
target). Hostnames are resolved via DNS first, so `some-internal-name.local`
pointing at a blocked address is caught, not just IP literals typed
directly. See `urlSafety.test.ts`. This is an allowlist-by-exclusion, not a
sandbox — the browser process still runs with the server's network access,
so treat `JARVIS_BROWSER_ALLOW_PRIVATE_NETWORKS=true` as equivalent to
giving the model a foothold on your internal network, and only set it if
you mean to.

Page content read via `browser.open`/`.click`/`.type` is treated as
external, untrusted data by the system prompt (see "Prompt-injection
defense" below) — the same rule as `web.search` results.

## Vision and voice data

- **Images**: `browser.screenshot` and `vision.describe_image` only ever
  read what's already reachable through an already-permitted path — the
  page the browser has open, or a file already inside
  `JARVIS_WORKSPACE_DIR` (same sandbox as `filesystem.*`). Neither tool
  introduces a new way to reach data outside those boundaries. Image bytes
  are sent to whichever LLM provider is configured (same trust boundary as
  the text of the conversation) and persisted in the local SQLite database
  alongside the rest of the conversation — nowhere else.
- **Voice**: audio recorded via push-to-talk is sent to the configured STT
  provider (OpenAI's API, if `STT_PROVIDER=openai`) to be transcribed, and
  the resulting text is treated exactly like a typed message from then on —
  same memory/tools/permissions/audit path, no separate trust tier. Audio
  bytes themselves are not persisted server-side; only the transcript is
  stored, the same as if you'd typed it. A synthesized voice reply (TTS) is
  generated per-request and streamed back, not cached.
- Both flows call out to a third-party API only when you've explicitly
  configured a provider — with everything left at `none`, no audio or
  image data leaves the machine beyond whatever LLM provider you've
  already configured for chat.

## Automation engine

Scheduled automations run through the exact same orchestrator, tools, and
`PermissionEngine` as an interactive chat message — there's no separate,
weaker code path for scheduled work. The practical consequence: if a
scheduled automation's prompt causes the model to request a `medium`/`high`
tool call, that run blocks waiting for approval like any other, but nobody
is watching a 3am automation's WebSocket — it will simply time out after 15
minutes and be recorded as a failed run. This is a known, honest gap, not
silently papered over: it's safer to have automations quietly fail closed
than to have them auto-approve risky actions unattended. If you write an
automation prompt, keep it to `safe`/`low` actions (memory, filesystem,
read-only browsing) unless you're actively available to approve it.

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
aren't built yet (`computer.*`, `calendar.*`, `email.*`) throw a
`ToolNotImplementedError` naming exactly what's missing — they are never
wired to return a fabricated success. An unconfigured voice provider
returns a plain 400 from `/voice-message`, never a fake transcript or
silent audio; a failed transcription returns 502 with the real upstream
error, never a guessed transcript. Failed tool calls, denied approvals,
and LLM provider errors are all reported to the user as failures, never
silently swallowed.
