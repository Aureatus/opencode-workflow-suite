# Notifier

This module controls workflow notification delivery.

## Behavior contract

- terminal-ready waits for enforcer idle outcome stability
- quiet-hours can suppress notifications when configured
- emits notifier telemetry with stable kinds: `notifier_sent`, `notifier_suppressed`

## Focus behavior

- notifications are delivered even when the terminal/session is focused
- `suppressWhenFocused` and `focusCommand` are accepted for compatibility but do not suppress delivery

## Configuration notes

- notify command env: `OPENCODE_WORKFLOW_SUITE_NOTIFY_COMMAND`
- timing envs:
  - `OPENCODE_WORKFLOW_SUITE_NOTIFIER_SETTLE_MS`
  - `OPENCODE_WORKFLOW_SUITE_NOTIFIER_MAX_WAIT_MS`
  - `OPENCODE_WORKFLOW_SUITE_NOTIFIER_POLL_MS`
- quiet-hours envs:
  - `OPENCODE_WORKFLOW_SUITE_QUIET_HOURS_ENABLED`
  - `OPENCODE_WORKFLOW_SUITE_QUIET_HOURS_START`
  - `OPENCODE_WORKFLOW_SUITE_QUIET_HOURS_END`

## Validation

- `test/workflow-notifier.test.ts`
- `test/workflow-notifier-command.test.ts`
