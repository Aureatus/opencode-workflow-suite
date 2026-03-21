# Agent Guide: opencode-workflow-suite

This file is for coding agents working in this repository.

## What This Plugin Does

`opencode-workflow-suite` combines two behaviors:

- Todo continuation enforcement for idle sessions
- Notifier gating that waits for enforcer outcomes before signaling ready

Primary entrypoints:

- `src/index.ts` (plugin wiring and compatibility aliases)
- `src/todo-enforcer/*` (idle guards, countdown, continuation injection)
- `src/notifier/*` (notification logic and suppression)
- `src/workflow-core/event-utils.ts` (shared event parsing contract)

## Compatibility Contract (Do Not Break)

Maintain these public exports in `src/index.ts` and `index.d.ts`:

- `WorkflowSuitePlugin`
- `createWorkflowSuitePlugin`
- `TodoEnforcerPlugin` (alias)
- `createTodoEnforcerPlugin` (alias)

Keep workflow-suite env vars as the primary naming, while retaining legacy compatibility where already supported.

## Telemetry and Event Contract

Telemetry is written as JSONL via `src/todo-enforcer/telemetry.ts`.

Expected event envelope fields:

- `event` (`workflow_suite` or legacy-compatible values)
- `kind`
- `session_id`
- `reason`
- `context`
- `timestamp`

Important notifier kinds used by tests/E2E:

- `notifier_sent`
- `notifier_suppressed`

Important enforcer kinds used by tests/E2E:

- `chat_message_seen`
- `idle_seen`
- `stop_set_chat`
- `debug_ping_tool`

When changing event names or reasons, update unit tests and E2E assertions together.

## E2E Rules and Pitfalls

E2E runner: `scripts/e2e-opencode-run.ts`

Key assumptions:

- Local mode plugin spec must use an absolute file path (`pkg@file:/abs/path`).
- E2E should isolate OpenCode config per case (`XDG_CONFIG_HOME`) to avoid user-global plugin interference.
- Notifier suppression scenario is validated through telemetry (`notifier_suppressed`) and currently uses quiet-hours env controls in-case.
- npm-mode E2E sandbox can be overridden only via `OPENCODE_WORKFLOW_SUITE_E2E_NPM_SANDBOX` (must be absolute).
- Retry behavior exists for transient CLI/network failures; keep retries scoped and deterministic.

## Notifier Focus Semantics

- Notifications are delivered even when the current terminal/session is focused.
- `suppressWhenFocused` and `focusCommand` are accepted for compatibility but do not suppress notifier delivery.

## Required Validation Before Merging

Run from repo root:

```bash
bun run check
OPENCODE_WORKFLOW_SUITE_E2E_STRICT=true bun run test:e2e
bun run test:e2e:npm
```

If source code changes, ensure build output is refreshed:

```bash
bun run build
```

## CI Expectations

CI file: `.github/workflows/ci.yml`

- `check` and `e2e` run on push/PR (not on scheduled runs)
- `e2e_npm` runs on schedule and optional manual dispatch

If CI behavior changes, preserve this intent unless there is a clear replacement.

## Editing Guidance

- Keep changes small and contract-safe; prefer explicit, test-backed behavior changes.
- Add or update tests with every behavioral change.
- Avoid introducing new top-level env naming unless necessary; prefer extending existing workflow-suite names.
- Do not remove migration notes in `README.md` without a coordinated major-version plan.

## Release and Versioning

Follow `RELEASING.md` for release flow.

Typical sequence:

```bash
bun run release:verify
bun run release:patch
```

Use `minor`/`major` only when API or behavior impact justifies it.
