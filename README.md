# opencode-workflow-suite

OpenCode workflow plugin that combines:

- todo continuation enforcement on idle sessions
- notifier gating that waits for enforcer outcomes before signaling "ready"

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

Legacy aliases are kept for compatibility:

- `TodoEnforcerPlugin`
- `createTodoEnforcerPlugin`

## Configuration

```ts
import { createWorkflowSuitePlugin } from "opencode-workflow-suite";

export default createWorkflowSuitePlugin({
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

## Notifier behavior

- waits `notifier.settleMs` after `session.idle`
- suppresses "ready" signal when enforcer continues work
- emits terminal-ready only when enforcer outcome is stable (`todo-complete` or settle timeout)
- can emit events for paused, enforcer-failure, permission, question, and error

Command placeholders:

- `{event}` `{message}` `{project}` `{reason}` `{sessionID}` `{sessionTitle}`

Env override:

- `OPENCODE_WORKFLOW_SUITE_NOTIFY_COMMAND=/path/to/script-or-binary`

Optional notifier controls:

- `suppressWhenFocused: true` to suppress notifications while terminal window is focused
- `focusCommand` to provide custom focus detection command (exit code `0` means focused)
- `quietHours` (`start`/`end` in `HH:MM`) to suppress notifications during quiet windows

```ts
notifier: {
  suppressWhenFocused: true,
  quietHours: {
    enabled: true,
    start: "22:00",
    end: "08:00",
  },
  focusCommand: {
    enabled: true,
    path: "/usr/local/bin/is-terminal-focused",
    args: [],
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

## Development

```bash
bun install
bun run check
bun run test:e2e
bun run test:e2e:npm
```

## Releasing

- `bun run release:verify`
- `bun run release:patch|minor|major|beta:first|beta:next`

See `RELEASING.md` for full workflow details.

## Migration from opencode-todo-enforcer

- Replace plugin entry:
  - from `opencode-todo-enforcer`
  - to `opencode-workflow-suite`
- Existing factory usage keeps working through compatibility aliases:
  - `TodoEnforcerPlugin`
  - `createTodoEnforcerPlugin`
  - legacy top-level enforcer options in `createTodoEnforcerPlugin(...)`

Primary env vars are now:

- `OPENCODE_WORKFLOW_SUITE_STOP_COMMAND`
- `OPENCODE_WORKFLOW_SUITE_NOTIFY_COMMAND`
- `OPENCODE_WORKFLOW_SUITE_TELEMETRY_PATH`
- `OPENCODE_WORKFLOW_SUITE_TELEMETRY_CONTEXT`
- `OPENCODE_WORKFLOW_SUITE_TELEMETRY`
- `OPENCODE_WORKFLOW_SUITE_E2E_MAX_ATTEMPTS`
- `OPENCODE_WORKFLOW_SUITE_E2E_STRICT`

Legacy `OPENCODE_TODO_ENFORCER_*` and `OPENCODE_WORKFLOW_NOTIFY_COMMAND` are still supported for compatibility.

Deprecation policy:

- compatibility aliases and legacy env vars are planned for removal in `v1.0.0`
