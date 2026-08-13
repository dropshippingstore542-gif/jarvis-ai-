# Jarvis

A private, local-first, modular personal AI assistant. Not a chatbot demo —
a foundation for an assistant that remembers context, uses tools under an
explicit permission model, and is designed to grow (voice, vision, computer
control, automation) without a rewrite.

This is **V1**: a working chat interface, a model-agnostic AI brain, durable
memory, a small set of genuinely functional tools, a permission/approval
system, and a full audit log. Voice, vision, browser/computer control, and
the automation engine are designed as clean interfaces with documented
next steps — see [ARCHITECTURE.md](./ARCHITECTURE.md) for exactly what's
implemented vs. what's a documented seam.

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
tools/permissions/audit) are implemented and tested. Voice, vision, browser
automation, computer control, and the automation/scheduler engine are
Phase 4–7 — see ARCHITECTURE.md for what exists today and what each needs.
