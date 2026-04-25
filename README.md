# opencode-workflow-suite

OpenCode workflow plugin that combines:

- todo continuation enforcement on idle sessions
- notifier gating that waits for enforcer outcomes before signaling "ready"
- external repo preparation via `repo_ensure_local`

## Component docs

- `src/todo-enforcer/README.md`
- `src/notifier/README.md`
- `src/repo-local/README.md`
- `src/workflow-core/README.md`

## Install

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-workflow-suite"]
}
```

For local development:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-workflow-suite@file:/absolute/path/to/opencode-workflow-suite"]
}
```

## Exports

```ts
import {
  createWorkflowSuitePlugin,
  WorkflowSuitePlugin,
} from "opencode-workflow-suite";
```

## Configuration

```ts
import { createWorkflowSuitePlugin } from "opencode-workflow-suite";

export default createWorkflowSuitePlugin({
  modules: {
    todoEnforcer: true,
    notifier: true,
    repoLocal: true,
  },
  todoEnforcer: {
    countdownMs: 1500,
    continuationCooldownMs: 7000,
    stopCommand: "/stop-continuation",
  },
  notifier: {
    settleMs: 3500,
    maxWaitMs: 10000,
    command: {
      enabled: true,
      path: "/usr/bin/paplay",
      args: ["/home/you/sounds/opencode-ready.ogg"],
    },
  },
});
```

Project config file (JSON/JSONC):

- `opencode-workflow-suite.config.jsonc`
- `opencode-workflow-suite.config.json`
- `.opencode/workflow-suite.config.jsonc`
- `.opencode/workflow-suite.config.json`

The plugin looks for these files in the current project/worktree and loads the first match.
Direct options passed to `createWorkflowSuitePlugin(...)` override file values.

JSON Schema:

- `https://unpkg.com/opencode-workflow-suite/schema/workflow-suite.config.schema.json`
- local package path: `schema/workflow-suite.config.schema.json`
- generated from Zod source (`src/workflow-core/workflow-suite-options.ts`)

Full example:

- `examples/opencode-workflow-suite.config.jsonc`

Example `opencode-workflow-suite.config.jsonc`:

```jsonc
{
  "$schema": "https://unpkg.com/opencode-workflow-suite/schema/workflow-suite.config.schema.json",
  "modules": {
    "todoEnforcer": true,
    "notifier": true,
    "repoLocal": false
  },
  "notifier": {
    "command": {
      "enabled": true,
      "path": "/usr/bin/paplay",
      "args": ["/home/you/sounds/opencode-ready.ogg"]
    },
    "events": {
      "terminalReady": true,
      "permission": false,
      "question": false
    }
  }
}
```

Configuration is file/direct-options first. Runtime env vars are intended for telemetry and test harness controls, not end-user feature configuration.

## Notifier behavior

- waits `notifier.settleMs` after `session.idle`
- suppresses "ready" signal when enforcer continues work
- emits terminal-ready only when enforcer outcome is stable (`todo-complete` or settle timeout)
- can emit events for paused, enforcer-failure, permission, question, and error

Command placeholders:

- `{event}` `{message}` `{project}` `{reason}` `{sessionID}` `{sessionTitle}`

Sound example (Linux):

```jsonc
{
  "notifier": {
    "command": {
      "enabled": true,
      "path": "paplay",
      "args": ["/home/you/sounds/opencode-ready.ogg"]
    }
  }
}
```

Optional notifier controls:

- `quietHours` (`start`/`end` in `HH:MM`) to suppress notifications during quiet windows

Focus-note:

- notifications are now delivered even when the current terminal/session is focused
- `suppressWhenFocused` and `focusCommand` do not suppress delivery

```ts
notifier: {
  quietHours: {
    enabled: true,
    start: "22:00",
    end: "08:00",
  },
}
```

## Todo enforcer defaults

- `countdownMs`: `2000`
- `countdownGraceMs`: `500`
- `continuationCooldownMs`: `5000`
- `abortWindowMs`: `3000`
- `maxConsecutiveFailures`: `5`

## Debug tool

- Tool: `todo_enforcer_debug_ping`
- Writes: `<session-directory>/.opencode-workflow-suite-debug-pings.jsonl`

## Repo tool

- Tool: `repo_ensure_local`
- Purpose: clone/update external repositories into a deterministic local root and return `local_path` for immediate `Read`/`Glob`/`Grep`/`Bash` usage

Arguments:

- `repo` (required): `https://host/owner/repo(.git)`, `git@host:owner/repo.git` (with `allow_ssh=true`), `host/owner/repo`, or `owner/repo`
- `ref` (optional): branch/tag/SHA to checkout after clone/fetch
- `depth` (optional): shallow clone depth
- `clone_root` (optional): absolute path override for local clone root
- `update_mode` (optional): `ff-only` (default), `fetch-only`, `reset-clean`
- `allow_ssh` (optional): allow SSH-style remote input
- `auth_mode` (optional): `auto` (default), `https`, `ssh`

## Development

```bash
bun install
bun run schema:generate
bun run check
bun run check:full
bun run test:e2e
bun run check:published
```

E2E notes:

- `OPENCODE_CONFIG_CONTENT` merges with existing OpenCode config; for deterministic runs, the E2E harness isolates config via `XDG_CONFIG_HOME`
- `OPENCODE_WORKFLOW_SUITE_E2E_NPM_SANDBOX` can override npm-mode sandbox path (must be absolute)
- default E2E model is `opencode/minimax-m2.5-free`
- override model with `OPENCODE_WORKFLOW_SUITE_E2E_MODEL`
- free-model enforcement is on by default; set `OPENCODE_WORKFLOW_SUITE_E2E_ENFORCE_FREE_MODEL=false` to allow non-free overrides
- `check:full` validates local source; `check:published` validates the currently published npm package

## Releasing

- `bun run release:verify`
- `bun run release:patch|minor|major|beta:first|beta:next`

See `RELEASING.md` for full workflow details.

Operational env vars (telemetry/tests):

- `OPENCODE_WORKFLOW_SUITE_TELEMETRY_PATH`
- `OPENCODE_WORKFLOW_SUITE_TELEMETRY_CONTEXT`
- `OPENCODE_WORKFLOW_SUITE_TELEMETRY`
- `OPENCODE_WORKFLOW_SUITE_E2E_MAX_ATTEMPTS`
- `OPENCODE_WORKFLOW_SUITE_E2E_STRICT`
- `OPENCODE_WORKFLOW_SUITE_E2E_NPM_SANDBOX`
- `OPENCODE_WORKFLOW_SUITE_E2E_MODEL`
- `OPENCODE_WORKFLOW_SUITE_E2E_ENFORCE_FREE_MODEL`
- `OPENCODE_REPO_TELEMETRY_PATH`
