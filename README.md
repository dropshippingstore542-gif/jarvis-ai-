# Jarvis

A private, local-first, modular personal AI assistant. Not a chatbot demo —
a foundation for an assistant that remembers context, uses tools under an
explicit permission model, and is designed to grow (voice, vision, computer
control, automation) without a rewrite.

This is **V1+**: a working chat interface, a model-agnostic AI brain,
durable memory, a permission/approval system with a full audit log, real
browser automation (Playwright, with an SSRF guard), a cron-based
automation engine/scheduler that survives restarts without double-firing,
real vision (the model genuinely sees screenshots and workspace images),
and real voice (push-to-talk with actual speech-to-text/text-to-speech).
What's left as a documented interface rather than built — continuous
wake-word listening and OS-level desktop control — is left that way because
a headless container has no microphone, speaker, or display to act on, not
because the code doesn't exist; see [ARCHITECTURE.md](./ARCHITECTURE.md)
for exactly what's implemented vs. what's a documented seam and why.

## Quickstart

Requirements: Node.js 20+.

```bash
npm install
cp .env.example .env
# edit .env — at minimum set AI_API_KEY for AI_PROVIDER=anthropic (the default)
npm run dev
```

This starts the API server (default `http://127.0.0.1:4317`) and the web UI
(`http://localhost:5173`) together. Open the web UI in a browser.

To run them separately: `npm run dev:server` / `npm run dev:web`.

Without an `AI_API_KEY`, the server still starts — the chat endpoint will
report a clear configuration error instead of a response, and every other
feature (memory, tools, audit log, approvals) still works so you can inspect
the system without a live model.

## Project layout

```
packages/core/    shared types + LLM provider abstraction + tool interface
apps/server/      Node/Fastify backend — the brain, memory, tools, permissions, audit, API
apps/web/         React/Vite frontend — dark, JARVIS-inspired UI
plugins/          discoverable plugin packages (see PLUGIN_DEVELOPMENT.md)
```

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — module map, what's implemented vs. interface-only
- [SECURITY.md](./SECURITY.md) — permission model, secret handling, prompt-injection defense
- [DEVELOPMENT.md](./DEVELOPMENT.md) — running locally, adding a tool, testing
- [PLUGIN_DEVELOPMENT.md](./PLUGIN_DEVELOPMENT.md) — writing a plugin
- [CONFIGURATION.md](./CONFIGURATION.md) — every environment variable

## Status

Built in phases per the original spec. Phase 1–3 (core backend, memory,
tools/permissions/audit), Phase 4 (browser control, vision), Phase 5
(voice — push-to-talk), and Phase 6 (automation engine/scheduler) are all
implemented and tested. Continuous wake-word listening and OS-level desktop
control remain documented interfaces — see ARCHITECTURE.md for what exists
today and exactly what each remaining piece needs.
