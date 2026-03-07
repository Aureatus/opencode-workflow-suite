import type { IdleSnapshot, SessionState, TodoEnforcerConfig } from "./types";

export type GuardDecision =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "recovering"
        | "abort-window"
        | "background-running"
        | "todo-empty"
        | "todo-complete"
        | "in-flight"
        | "max-failures"
        | "cooldown"
        | "skipped-agent"
        | "stop-state";
    };

interface GuardInput {
  state: SessionState;
  snapshot: IdleSnapshot;
  config: TodoEnforcerConfig;
  isStopped: boolean;
  hasRunningBackgroundTasks: boolean;
}

const normalizeAgentKey = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]/g, "");
};

const isAgentSkipped = (skipAgents: string[], agent: string): boolean => {
  const target = normalizeAgentKey(agent);
  return skipAgents.some((item) => normalizeAgentKey(item) === target);
};

export const evaluateIdleGuards = (input: GuardInput): GuardDecision => {
  const { state, snapshot, config, isStopped, hasRunningBackgroundTasks } =
    input;
  const now = config.now();

  if (state.isRecovering) {
    return { ok: false, reason: "recovering" };
  }

  if (
    config.guards.abortWindow &&
    state.abortDetectedAt &&
    now - state.abortDetectedAt < config.abortWindowMs
  ) {
    return { ok: false, reason: "abort-window" };
  }

  if (config.guards.backgroundTasks && hasRunningBackgroundTasks) {
    return { ok: false, reason: "background-running" };
  }

  if (snapshot.todos.length === 0) {
    return { ok: false, reason: "todo-empty" };
  }

  if (snapshot.incompleteCount === 0) {
    return { ok: false, reason: "todo-complete" };
  }

  if (state.inFlight) {
    return { ok: false, reason: "in-flight" };
  }

  if (
    state.consecutiveFailures >= config.maxConsecutiveFailures &&
    state.lastInjectedAt &&
    now - state.lastInjectedAt >= config.failureResetWindowMs
  ) {
    state.consecutiveFailures = 0;
  }

  if (state.consecutiveFailures >= config.maxConsecutiveFailures) {
    return { ok: false, reason: "max-failures" };
  }

  const effectiveCooldown =
    config.continuationCooldownMs *
    2 ** Math.min(state.consecutiveFailures, config.maxConsecutiveFailures);

  if (state.lastInjectedAt && now - state.lastInjectedAt < effectiveCooldown) {
    return { ok: false, reason: "cooldown" };
  }

  if (
    config.guards.skippedAgents &&
    snapshot.resolvedInfo.agent &&
    isAgentSkipped(config.skipAgents, snapshot.resolvedInfo.agent)
  ) {
    return { ok: false, reason: "skipped-agent" };
  }

  if (config.guards.stopState && isStopped) {
    return { ok: false, reason: "stop-state" };
  }

  return { ok: true };
};
