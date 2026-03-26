# Agent Notes: todo-enforcer

## Scope

Use for edits under `src/todo-enforcer/*`.

## Must Preserve

- Lifecycle event names unless tests/notifier/docs are updated in the same change.
- Stop-command semantics (`/stop-continuation` behavior and pause/resume flow).
- Guard decisions should remain explainable via explicit `reason` values.

## Change Impact

- If lifecycle kinds change, update notifier handling in `src/notifier/notifier.ts`.
- If session/message extraction assumptions change, verify `src/workflow-core/event-utils.ts` contracts.

## Validation

- Fast loop: `bun test test/todo-enforcer-orchestrator.test.ts && bun run scripts/integration-test.ts`
- Completion gate before claiming done: `bun run check:full`
