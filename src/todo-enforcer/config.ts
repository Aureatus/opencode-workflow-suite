import type { TodoEnforcerOptions } from "../workflow-core/workflow-suite-options";
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

export type { TodoEnforcerOptions } from "../workflow-core/workflow-suite-options";

const defaultNow = (): number => Date.now();

export const createTodoEnforcerConfig = (
  options?: TodoEnforcerOptions
): TodoEnforcerConfig => {
  return {
    enabled: options?.enabled ?? true,
    prompt: options?.prompt ?? CONTINUATION_PROMPT,
    stopCommand: options?.stopCommand ?? STOP_CONTINUATION_COMMAND,
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
