# Workflow Core

Shared utility helpers used across workflow modules.

Current contents:

- `event-utils.ts`
- `file-config.ts`
- `workflow-suite-options.ts`

Key contracts:

- `extractSessionIDFromEvent(event)`
- `extractMessageRoleFromEvent(event)`
- `isPermissionEvent(event)`
- `loadWorkflowSuiteOptionsFromFile(input)`
- `mergeWorkflowSuiteOptions(fileOptions, directOptions)`

Type/schema source of truth:

- `workflow-suite-options.ts` defines Zod schemas for workflow config
- JSON Schema is generated from those Zod schemas into `schema/workflow-suite.config.schema.json`

These are covered by `test/workflow-event-utils.test.ts` and should remain stable because both notifier and todo-enforcer depend on them.
