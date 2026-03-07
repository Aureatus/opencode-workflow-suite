import {
  CONTINUATION_PROMPT,
  DEFAULT_ABORT_WINDOW_MS,
  DEFAULT_COOLDOWN_MS,
  DEFAULT_COUNTDOWN_GRACE_MS,
  DEFAULT_COUNTDOWN_MS,
  DEFAULT_FAILURE_RESET_WINDOW_MS,
  DEFAULT_MAX_CONSECUTIVE_FAILURES,
  DEFAULT_PRUNE_INTERVAL_MS,
  DEFAULT_SESSION_TTL_MS,
  DEFAULT_SKIP_AGENTS,
  STOP_CONTINUATION_COMMAND,
} from "./constants";
import type { TodoEnforcerConfig } from "./types";

export interface TodoEnforcerOptions {
  enabled?: boolean;
  prompt?: string;
  stopCommand?: string;
  skipAgents?: string[];
  countdownMs?: number;
  countdownGraceMs?: number;
  continuationCooldownMs?: number;
  abortWindowMs?: number;
  failureResetWindowMs?: number;
  maxConsecutiveFailures?: number;
  sessionTtlMs?: number;
  sessionPruneIntervalMs?: number;
  debug?: boolean;
  guards?: {
    abortWindow?: boolean;
    backgroundTasks?: boolean;
    skippedAgents?: boolean;
    stopState?: boolean;
  };
  hasRunningBackgroundTasks?: (sessionID: string) => boolean;
  now?: () => number;
}

const defaultNow = (): number => Date.now();

const envValue = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
};

export const createTodoEnforcerConfig = (
  options?: TodoEnforcerOptions
): TodoEnforcerConfig => {
  return {
    enabled: options?.enabled ?? true,
    prompt: options?.prompt ?? CONTINUATION_PROMPT,
    stopCommand:
      options?.stopCommand ??
      envValue("OPENCODE_WORKFLOW_SUITE_STOP_COMMAND") ??
      envValue("OPENCODE_TODO_ENFORCER_STOP_COMMAND") ??
      STOP_CONTINUATION_COMMAND,
    skipAgents: options?.skipAgents ?? [...DEFAULT_SKIP_AGENTS],
    countdownMs: options?.countdownMs ?? DEFAULT_COUNTDOWN_MS,
    countdownGraceMs: options?.countdownGraceMs ?? DEFAULT_COUNTDOWN_GRACE_MS,
    continuationCooldownMs:
      options?.continuationCooldownMs ?? DEFAULT_COOLDOWN_MS,
    abortWindowMs: options?.abortWindowMs ?? DEFAULT_ABORT_WINDOW_MS,
    failureResetWindowMs:
      options?.failureResetWindowMs ?? DEFAULT_FAILURE_RESET_WINDOW_MS,
    maxConsecutiveFailures:
      options?.maxConsecutiveFailures ?? DEFAULT_MAX_CONSECUTIVE_FAILURES,
    sessionTtlMs: options?.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS,
    sessionPruneIntervalMs:
      options?.sessionPruneIntervalMs ?? DEFAULT_PRUNE_INTERVAL_MS,
    debug: options?.debug ?? false,
    guards: {
      abortWindow: options?.guards?.abortWindow ?? true,
      backgroundTasks: options?.guards?.backgroundTasks ?? true,
      skippedAgents: options?.guards?.skippedAgents ?? true,
      stopState: options?.guards?.stopState ?? true,
    },
    hasRunningBackgroundTasks: options?.hasRunningBackgroundTasks,
    now: options?.now ?? defaultNow,
  };
};
