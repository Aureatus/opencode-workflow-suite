import type { WorkflowNotifierConfig } from "./types";

export interface WorkflowNotifierOptions {
  enabled?: boolean;
  settleMs?: number;
  maxWaitMs?: number;
  pollMs?: number;
  cooldownMs?: number;
  showToastFallback?: boolean;
  suppressWhenFocused?: boolean;
  focusTitleHints?: string[];
  quietHours?: {
    enabled?: boolean;
    start?: string;
    end?: string;
  };
  events?: {
    terminalReady?: boolean;
    paused?: boolean;
    enforcerFailure?: boolean;
    error?: boolean;
    permission?: boolean;
    question?: boolean;
  };
  command?: {
    enabled?: boolean;
    path?: string;
    args?: string[];
  };
  focusCommand?: {
    enabled?: boolean;
    path?: string;
    args?: string[];
  };
  now?: () => number;
}

const defaultNow = (): number => Date.now();

const DEFAULT_FOCUS_TITLE_HINTS = [
  "ghostty",
  "opencode",
  "kitty",
  "wezterm",
  "alacritty",
  "terminal",
] as const;

const envValue = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
};

const envBoolean = (name: string): boolean | undefined => {
  const value = envValue(name)?.toLowerCase();
  if (!value) {
    return undefined;
  }
  if (value === "true" || value === "1" || value === "yes") {
    return true;
  }
  if (value === "false" || value === "0" || value === "no") {
    return false;
  }
  return undefined;
};

const envNumber = (name: string): number | undefined => {
  const value = envValue(name);
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
};

const resolveNotifyCommandPath = (
  options?: WorkflowNotifierOptions
): string => {
  return (
    options?.command?.path ??
    envValue("OPENCODE_WORKFLOW_SUITE_NOTIFY_COMMAND") ??
    envValue("OPENCODE_WORKFLOW_NOTIFY_COMMAND") ??
    ""
  );
};

const resolveFocusCommandPath = (options?: WorkflowNotifierOptions): string => {
  return (
    options?.focusCommand?.path ??
    envValue("OPENCODE_WORKFLOW_SUITE_FOCUS_COMMAND") ??
    ""
  );
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
    settleMs:
      options?.settleMs ??
      envNumber("OPENCODE_WORKFLOW_SUITE_NOTIFIER_SETTLE_MS") ??
      3000,
    maxWaitMs:
      options?.maxWaitMs ??
      envNumber("OPENCODE_WORKFLOW_SUITE_NOTIFIER_MAX_WAIT_MS") ??
      10_000,
    pollMs:
      options?.pollMs ??
      envNumber("OPENCODE_WORKFLOW_SUITE_NOTIFIER_POLL_MS") ??
      400,
    cooldownMs: options?.cooldownMs ?? 1500,
    showToastFallback: options?.showToastFallback ?? true,
    suppressWhenFocused:
      options?.suppressWhenFocused ??
      envBoolean("OPENCODE_WORKFLOW_SUITE_SUPPRESS_WHEN_FOCUSED") ??
      false,
    focusTitleHints: options?.focusTitleHints ?? [...DEFAULT_FOCUS_TITLE_HINTS],
    quietHours: {
      enabled:
        options?.quietHours?.enabled ??
        envBoolean("OPENCODE_WORKFLOW_SUITE_QUIET_HOURS_ENABLED") ??
        quietHours.enabled,
      start:
        options?.quietHours?.start ??
        envValue("OPENCODE_WORKFLOW_SUITE_QUIET_HOURS_START") ??
        quietHours.start,
      end:
        options?.quietHours?.end ??
        envValue("OPENCODE_WORKFLOW_SUITE_QUIET_HOURS_END") ??
        quietHours.end,
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
