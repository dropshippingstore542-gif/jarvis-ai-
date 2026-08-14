# Plugin Development

Plugins add tools without touching core code. `plugins/example-plugin` is a
complete, working reference — read it alongside this doc.

## Shape

A plugin is an npm workspace package under `plugins/<name>/` whose built
entrypoint (`dist/index.js`) default-exports an object matching
`JarvisPlugin` (`packages/core/src/types/plugin.ts`):

```ts
export interface JarvisPlugin {
  manifest: { name: string; version: string; description: string };
  registerTools(registry: ToolRegistry, ctx: PluginContext): Tool[] | Promise<Tool[]>;
}
```

`registerTools` returns the tools this plugin provides — the loader adds
them to the shared registry, so return the array, don't call
`registry.register()` yourself (the `registry` argument is there in case a
plugin needs to check what's already registered, e.g. to avoid a name
clash).

## Minimal example

```
plugins/my-plugin/
  package.json     name: "@jarvis/plugin-my-plugin", main: "./dist/index.js"
  tsconfig.json     extends ../../tsconfig.base.json, composite: true, references core
  src/index.ts
```

```ts
// src/index.ts
import { z } from "zod";
import type { JarvisPlugin, Tool } from "@jarvis/core";

const myTool: Tool<{ input: string }, { output: string }> = {
  name: "my-plugin.do-thing",
  description: "...",
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ output: z.string() }),
  permission: "safe",
  async execute(input) {
    return { output: input.input };
  },
};

const plugin: JarvisPlugin = {
  manifest: { name: "@jarvis/plugin-my-plugin", version: "0.1.0", description: "..." },
  registerTools() {
    return [myTool];
  },
};

export default plugin;
```

Build it (`npm run build --workspace=@jarvis/plugin-my-plugin`) so
`dist/index.js` exists — the loader only imports built output, never source,
so a broken build fails loudly (a log line saying the plugin was skipped)
rather than silently running stale code.

## Discovery

`apps/server/src/plugins/loader.ts` scans every subdirectory of the
repo-root `plugins/` directory at server startup, looks for
`dist/index.js`, imports it, and registers whatever tools its default
export returns. A plugin that isn't built, doesn't export a valid
`JarvisPlugin`, or throws during `registerTools()` is logged and skipped —
it never crashes the server and never silently pretends to be active. Check
the server log at startup to confirm your plugin loaded.

## Naming

Prefix tool names with your plugin's short name (`my-plugin.do-thing`, like
the built-in `memory.*`/`filesystem.*` families) to avoid collisions.
`ToolRegistry.register()` throws on a duplicate name.

## Permissions

Pick a tier honestly — see SECURITY.md's table. A plugin cannot bypass the
permission engine; declaring `medium`/`high` is what causes the approval
flow to trigger, not something a plugin can opt out of.

## Configuration

Plugins receive `ctx.config`, currently the process's environment variables
(`process.env`). If your plugin needs its own credentials, document them in
your plugin's own README and read them from `ctx.config` inside
`registerTools`/`execute` — don't add plugin-specific variables to the core
`.env.example`.

## What's not built yet

There's no plugin marketplace, versioning/update mechanism, or permission
manifest enforcement (a plugin can currently declare any permission tier for
its own tools) beyond the loader itself. For now, only install plugins you
trust, the same way you'd trust any local npm package.
