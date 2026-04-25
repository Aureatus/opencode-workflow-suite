# Notifier

This module controls workflow notification delivery.

## Behavior contract

- terminal-ready waits for enforcer idle outcome stability
- quiet-hours can suppress notifications when configured
- emits notifier telemetry with stable kinds: `notifier_sent`, `notifier_suppressed`

## Focus behavior

- notifications are delivered even when the terminal/session is focused
- `suppressWhenFocused` and `focusCommand` do not suppress delivery

## Configuration notes

- preferred: set notifier behavior in project config (`opencode-workflow-suite.config.jsonc`)
- notifier settings are read from config file / direct plugin options (`notifier.*`)

## Validation

- `test/workflow-notifier.test.ts`
- `test/workflow-notifier-command.test.ts`
