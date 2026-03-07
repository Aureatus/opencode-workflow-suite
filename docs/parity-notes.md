# Todo Enforcer Parity Notes

This standalone implementation mirrors the upstream `todo-continuation-enforcer` behavior where possible without importing internal `oh-my-opencode` modules.

## Parity maintained

- Idle-triggered continuation flow (`session.idle` only)
- Guard order for recovery/abort/background/todo/in-flight/failure/cooldown/skip/stop
- Exponential cooldown based on consecutive failures
- Countdown-based delayed continuation injection
- Cancellation on non-idle activity (`message.updated`, `message.part.updated`, tool lifecycle, status changes)
- Per-session stop control with `/stop-continuation`

## Intentional differences

- No internal background manager dependency; background activity check is optional via `hasRunningBackgroundTasks`
- No upstream shared helper imports (response normalization, system directives, storage detection)
- Stop command is implemented through chat/event interception rather than built-in command registration

## Safety controls

- Per-session state store with TTL pruning
- Consecutive failure cap and reset window
- Abort window suppression after detected abort-like assistant errors
