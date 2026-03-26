# Changelog

## Unreleased

- Remove legacy alias exports `TodoEnforcerPlugin` and `createTodoEnforcerPlugin`; use `WorkflowSuitePlugin` and `createWorkflowSuitePlugin`.
- Remove legacy workflow env fallbacks (`OPENCODE_TODO_ENFORCER_*`, `OPENCODE_WORKFLOW_NOTIFY_COMMAND`) and legacy top-level plugin option normalization.
- Add `repo_ensure_local` tool support directly in `opencode-workflow-suite` so repo preparation can be configured from one plugin.
- Keep notifier delivery active even when the current terminal/session is focused.
- Add `OPENCODE_WORKFLOW_SUITE_E2E_NPM_SANDBOX` as an env-only absolute path override for npm-mode E2E sandboxing.
- Clarify README guidance around OpenCode config merge behavior for deterministic E2E runs.
