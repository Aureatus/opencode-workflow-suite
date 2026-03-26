# Todo Enforcer

This module controls idle-session continuation behavior.

## Behavior contract

- on `session.idle`, evaluate guards before any continuation action
- if allowed, start countdown and inject continuation prompt on elapsed
- pause/resume per-session behavior via stop command (default `/stop-continuation`)
- emit lifecycle events consumed by telemetry and notifier coordination

## Lifecycle contract

Common lifecycle kinds emitted by the orchestrator include:

- `idle_seen`, `idle_skipped`, `countdown_started`, `countdown_cancelled`
- `injected`, `injection_skipped`
- `chat_message_seen`, `stop_set_chat`, `stop_cleared_chat`, `stop_set_command`
- `abort_detected`, `non_abort_error`, `session_deleted`

Notifier logic depends on these events; rename with care.

## Configuration

- options are defined in `config.ts` (`TodoEnforcerOptions`)
- stop command env: `OPENCODE_WORKFLOW_SUITE_STOP_COMMAND`

## Validation

- `test/todo-enforcer-orchestrator.test.ts`
- `scripts/integration-test.ts`
