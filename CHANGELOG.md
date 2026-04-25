# Changelog

## Unreleased

- Add project config file loading (`opencode-workflow-suite.config.json[c]` and `.opencode/workflow-suite.config.json[c]`) for granular module toggles and notifier behavior.
- Support JSONC-configured notifier command args and per-event toggles without relying on env-only configuration.
- Add published JSON Schema for config validation (`schema/workflow-suite.config.schema.json`) and a complete example config (`examples/opencode-workflow-suite.config.jsonc`).
- Derive config types and JSON Schema from shared Zod schemas (`src/workflow-core/workflow-suite-options.ts`) to keep type and schema in sync.
- Remove end-user runtime env controls for workflow behavior; keep user-facing configuration in file/direct options and reserve env for telemetry/tests.
- Use a free default model for E2E (`opencode/minimax-m2.5-free`) with optional override and free-model enforcement.
- Remove legacy alias exports `TodoEnforcerPlugin` and `createTodoEnforcerPlugin`; use `WorkflowSuitePlugin` and `createWorkflowSuitePlugin`.
- Remove legacy workflow env fallbacks (`OPENCODE_TODO_ENFORCER_*`, `OPENCODE_WORKFLOW_NOTIFY_COMMAND`) and legacy top-level plugin option normalization.
- Add `repo_ensure_local` tool support directly in `opencode-workflow-suite` so repo preparation can be configured from one plugin.
- Keep notifier delivery active even when the current terminal/session is focused.
- Add `OPENCODE_WORKFLOW_SUITE_E2E_NPM_SANDBOX` as an env-only absolute path override for npm-mode E2E sandboxing.
- Clarify README guidance around OpenCode config merge behavior for deterministic E2E runs.
