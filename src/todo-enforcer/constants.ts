export const TODO_ENFORCER_NAME = "todo-continuation-enforcer";

export const CONTINUATION_PROMPT = [
  "Resume work from the current todo list.",
  "Focus on the highest priority incomplete item.",
  "If all tasks are done, update todos accordingly and stop.",
].join(" ");

export const STOP_CONTINUATION_COMMAND = "/stop-continuation";

export const DEFAULT_COUNTDOWN_MS = 2000;
export const DEFAULT_COOLDOWN_MS = 5000;
export const DEFAULT_ABORT_WINDOW_MS = 3000;
export const DEFAULT_FAILURE_RESET_WINDOW_MS = 60_000;
export const DEFAULT_MAX_CONSECUTIVE_FAILURES = 5;
export const DEFAULT_COUNTDOWN_GRACE_MS = 500;
export const DEFAULT_SESSION_TTL_MS = 10 * 60 * 1000;
export const DEFAULT_PRUNE_INTERVAL_MS = 2 * 60 * 1000;

export const DEFAULT_SKIP_AGENTS = ["prometheus", "compaction"] as const;
export const INTERNAL_INITIATOR_MARKER = "todo-enforcer:internal";
