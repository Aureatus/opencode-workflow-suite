# Workflow Core

Shared utility helpers used across workflow modules.

Current contents:

- `event-utils.ts`

Key contracts:

- `extractSessionIDFromEvent(event)`
- `extractMessageRoleFromEvent(event)`
- `isPermissionEvent(event)`

These are covered by `test/workflow-event-utils.test.ts` and should remain stable because both notifier and todo-enforcer depend on them.
