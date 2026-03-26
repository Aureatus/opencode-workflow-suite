# Agent Notes: notifier

## Scope

Use for edits under `src/notifier/*`.

## Must Preserve

- Telemetry kinds: `notifier_sent`, `notifier_suppressed`.
- Command placeholders: `{event}`, `{message}`, `{project}`, `{reason}`, `{sessionID}`, `{sessionTitle}`.
- Focus semantics: focused terminals do not suppress notification delivery.

## Change Impact

- If settle/suppression behavior changes, update E2E assertions in `scripts/e2e-opencode-run.ts`.
- If notifier lifecycle interpretation changes, verify coordination with `src/todo-enforcer/orchestrator.ts`.

## Validation

- Fast loop: `bun test test/workflow-notifier.test.ts test/workflow-notifier-command.test.ts`
- Completion gate before claiming done: `bun run check:full`
