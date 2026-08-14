# Configuration

All configuration is environment variables, loaded from `.env` by
`apps/server/src/config.ts` (via `dotenv`) and validated with Zod at
startup — an invalid value fails fast with a clear message instead of a
confusing runtime error later. See `.env.example` for the canonical list
with inline comments; this file explains each one.

## AI Provider

| Variable | Default | Notes |
|---|---|---|
| `AI_PROVIDER` | `anthropic` | `anthropic` \| `openai` \| `local` |
| `AI_MODEL` | `claude-sonnet-4-5` | passed through as-is to the provider |
| `AI_API_KEY` | — | required for `anthropic`/`openai`; never committed |
| `AI_BASE_URL` | — | required for `local` (e.g. `http://localhost:11434/v1` for Ollama); optional override for `anthropic`/`openai` |

Changing these requires a server restart — provider selection happens once
at boot (`apps/server/src/context.ts`), deliberately not hot-swappable
mid-session.

## Database

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `./data/jarvis.sqlite` | SQLite file path, created on first run |

## Filesystem sandbox

| Variable | Default | Notes |
|---|---|---|
| `JARVIS_WORKSPACE_DIR` | `./workspace` | every `filesystem.*` tool call is jailed here — see SECURITY.md |

## Web search

| Variable | Default | Notes |
|---|---|---|
| `WEB_SEARCH_PROVIDER` | `none` | `none` \| `brave` \| `serpapi` |
| `WEB_SEARCH_API_KEY` | — | required unless provider is `none` |

With `WEB_SEARCH_PROVIDER=none`, `web.search` reports itself as
unconfigured rather than returning fabricated results.

## Browser automation

| Variable | Default | Notes |
|---|---|---|
| `JARVIS_BROWSER_ALLOW_PRIVATE_NETWORKS` | `false` | set `true` only to let `browser.*` reach loopback/private/link-local addresses — see SECURITY.md's SSRF guard section before enabling |

## Voice

| Variable | Default | Notes |
|---|---|---|
| `TTS_PROVIDER` | `none` | `none` \| `openai` — real OpenAI TTS when set |
| `STT_PROVIDER` | `none` | `none` \| `openai` — real Whisper transcription when set |
| `VOICE_API_KEY` | — | required for either provider above; shared by both (both are OpenAI endpoints) |
| `WAKE_WORD` | `JARVIS` | surfaced in the system prompt and settings; no continuous mic-listening loop exists to act on it yet — see ARCHITECTURE.md |

Push-to-talk in the web UI (`VoiceButton`) needs `STT_PROVIDER` configured to
send a voice message at all; `TTS_PROVIDER` is independently optional — with
it unset, voice input still works and you get a text reply, just no spoken
one.

## Email

| Variable | Default | Notes |
|---|---|---|
| `EMAIL_PROVIDER` | `none` | `none` \| `smtp` — real SMTP delivery via nodemailer when set |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | — / `587` / `false` | your SMTP server; works with Gmail (`smtp.gmail.com`, an app password, port 587) or any other provider |
| `SMTP_USER` / `SMTP_PASS` | — | credentials — an app password is strongly preferred over your real account password |
| `EMAIL_FROM` | — | the `From:` header on sent mail |

`email.send` is `permission: "high"` — every call requires explicit typed
approval, regardless of configuration. See SECURITY.md.

## Calendar

No environment variables — `calendar.create_event`/`.list_events` always
work, storing events in the local SQLite database. `GET
/api/calendar.ics` serves them as a real, standards-compliant iCalendar
feed you can subscribe to from Google/Apple/Outlook calendar; the exact
URL (including the `?token=` param when `API_AUTH_TOKEN` is set) is shown
in the Settings panel.

## Proactive behavior

| Variable | Default | Notes |
|---|---|---|
| `PROACTIVE_MODE` | `off` | `off` \| `low` \| `normal` \| `high` — the automation engine runs regardless of this setting; it only governs how notifications will be surfaced once a delivery channel exists (see ARCHITECTURE.md) |

## Server

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `4317` | |
| `HOST` | `127.0.0.1` | bind to `0.0.0.0` only if you understand the WS auth caveat in SECURITY.md |
| `API_AUTH_TOKEN` | — | bearer token for the REST API; unset = open on localhost (local-dev convenience) |

## Logging

| Variable | Default | Notes |
|---|---|---|
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |

## Frontend (`apps/web`)

Read via Vite's `import.meta.env`, set in `apps/web/.env` (separate from the
server's `.env`) if you need non-default values:

| Variable | Default | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:4317` | where the web UI reaches the server |
| `VITE_API_AUTH_TOKEN` | — | must match the server's `API_AUTH_TOKEN` if set |
