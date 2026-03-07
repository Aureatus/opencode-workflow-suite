import type { SessionState, TodoEnforcerConfig } from "./types";

interface StoredState {
  state: SessionState;
  touchedAt: number;
}

const createInitialState = (): SessionState => {
  return {
    inFlight: false,
    isRecovering: false,
    consecutiveFailures: 0,
  };
};

export interface SessionStateStore {
  get: (sessionID: string) => SessionState;
  touch: (sessionID: string) => void;
  clear: (sessionID: string) => void;
  clearAll: () => void;
  prune: () => void;
}

export const createSessionStateStore = (
  config: TodoEnforcerConfig
): SessionStateStore => {
  const sessions = new Map<string, StoredState>();
  let lastPruneAt = config.now();

  const clearTimers = (state: SessionState): void => {
    if (state.countdownTimer) {
      clearTimeout(state.countdownTimer);
      state.countdownTimer = undefined;
    }
    if (state.warningTimer) {
      clearTimeout(state.warningTimer);
      state.warningTimer = undefined;
    }
    state.countdownStartedAt = undefined;
  };

  const get = (sessionID: string): SessionState => {
    const existing = sessions.get(sessionID);
    if (existing) {
      existing.touchedAt = config.now();
      return existing.state;
    }

    const created = createInitialState();
    sessions.set(sessionID, { state: created, touchedAt: config.now() });
    return created;
  };

  const touch = (sessionID: string): void => {
    const existing = sessions.get(sessionID);
    if (existing) {
      existing.touchedAt = config.now();
      return;
    }
    get(sessionID);
  };

  const clear = (sessionID: string): void => {
    const existing = sessions.get(sessionID);
    if (!existing) {
      return;
    }
    clearTimers(existing.state);
    sessions.delete(sessionID);
  };

  const clearAll = (): void => {
    for (const entry of sessions.values()) {
      clearTimers(entry.state);
    }
    sessions.clear();
  };

  const prune = (): void => {
    const now = config.now();
    if (now - lastPruneAt < config.sessionPruneIntervalMs) {
      return;
    }
    lastPruneAt = now;

    for (const [sessionID, entry] of sessions.entries()) {
      if (now - entry.touchedAt <= config.sessionTtlMs) {
        continue;
      }
      clearTimers(entry.state);
      sessions.delete(sessionID);
    }
  };

  return {
    get,
    touch,
    clear,
    clearAll,
    prune,
  };
};
