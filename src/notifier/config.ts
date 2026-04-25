import type { WorkflowNotifierOptions } from "../workflow-core/workflow-suite-options";
import type { WorkflowNotifierConfig } from "./types";

export type { WorkflowNotifierOptions } from "../workflow-core/workflow-suite-options";

const defaultNow = (): number => Date.now();

const DEFAULT_FOCUS_TITLE_HINTS = [
  "ghostty",
  "opencode",
  "kitty",
  "wezterm",
  "alacritty",
  "terminal",
] as const;

const resolveNotifyCommandPath = (
  options?: WorkflowNotifierOptions
): string => {
  return options?.command?.path ?? "";
};

const resolveFocusCommandPath = (options?: WorkflowNotifierOptions): string => {
  return options?.focusCommand?.path ?? "";
};

const resolveEvents = (options?: WorkflowNotifierOptions) => {
  return {
    terminalReady: options?.events?.terminalReady ?? true,
    paused: options?.events?.paused ?? true,
    enforcerFailure: options?.events?.enforcerFailure ?? true,
    error: options?.events?.error ?? true,
    permission: options?.events?.permission ?? true,
    question: options?.events?.question ?? true,
  };
};

const resolveQuietHours = (options?: WorkflowNotifierOptions) => {
  return {
    enabled: options?.quietHours?.enabled ?? false,
    start: options?.quietHours?.start ?? "22:00",
    end: options?.quietHours?.end ?? "08:00",
  };
};

export const createWorkflowNotifierConfig = (
  options?: WorkflowNotifierOptions
): WorkflowNotifierConfig => {
  const commandPath = resolveNotifyCommandPath(options);
  const focusCommandPath = resolveFocusCommandPath(options);
  const quietHours = resolveQuietHours(options);

  return {
    enabled: options?.enabled ?? true,
    settleMs: options?.settleMs ?? 3000,
    maxWaitMs: options?.maxWaitMs ?? 10_000,
    pollMs: options?.pollMs ?? 400,
    cooldownMs: options?.cooldownMs ?? 1500,
    showToastFallback: options?.showToastFallback ?? true,
    suppressWhenFocused: options?.suppressWhenFocused ?? false,
    focusTitleHints: options?.focusTitleHints ?? [...DEFAULT_FOCUS_TITLE_HINTS],
    quietHours: {
      enabled: options?.quietHours?.enabled ?? quietHours.enabled,
      start: options?.quietHours?.start ?? quietHours.start,
      end: options?.quietHours?.end ?? quietHours.end,
    },
    events: resolveEvents(options),
    command: {
      enabled: options?.command?.enabled ?? commandPath.length > 0,
      path: commandPath,
      args: options?.command?.args ?? ["{event}", "{message}"],
    },
    focusCommand: {
      enabled: options?.focusCommand?.enabled ?? focusCommandPath.length > 0,
      path: focusCommandPath,
      args: options?.focusCommand?.args ?? [],
    },
    now: options?.now ?? defaultNow,
  };
};
