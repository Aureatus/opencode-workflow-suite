# Agent Guide: opencode-workflow-suite

## Scope

This file applies to the whole repository.

If a change is isolated to one module, also follow the closest scoped guide:

- `src/todo-enforcer/AGENTS.md`
- `src/notifier/AGENTS.md`
- `src/repo-local/AGENTS.md`

## Must Preserve

- Public exports in `src/index.ts` / `index.d.ts`:
  - `WorkflowSuitePlugin`
  - `createWorkflowSuitePlugin`
  - `TodoEnforcerPlugin` (alias)
  - `createTodoEnforcerPlugin` (alias)
- Workflow-suite env names are primary; keep supported legacy env compatibility unless intentionally planned for a breaking release.
- Notifier telemetry kinds stay stable: `notifier_sent`, `notifier_suppressed`.
- Enforcer lifecycle kinds used by tests/E2E stay stable: `chat_message_seen`, `idle_seen`, `stop_set_chat`, `debug_ping_tool`.
- Repo-local tool compatibility stays stable (`repo_ensure_local` args/result field names).

## Do Not

- Do not silently rename event kinds, tool args, or output fields without updating tests/docs in the same change.
- Do not remove compatibility aliases/env support without explicit migration intent.

## Completion Gate

Before claiming work is done/correct/validated, run:

```bash
bun run check:full
```

If you cannot run it, do not claim full validation. State exactly what was not run and why.

## Ask User If

- A change is breaking (public exports, event names, env names, tool schema/result shape).
- A destructive repo-local behavior change is required (default update policy, reset semantics, auth posture).
