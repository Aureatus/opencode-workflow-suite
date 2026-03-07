import { describe, expect, test } from "bun:test";

import { createTodoEnforcerConfig } from "../src/todo-enforcer/config";
import { evaluateIdleGuards } from "../src/todo-enforcer/guards";
import type { IdleSnapshot, SessionState } from "../src/todo-enforcer/types";

const createState = (): SessionState => {
  return {
    inFlight: false,
    isRecovering: false,
    consecutiveFailures: 0,
  };
};

const createSnapshot = (): IdleSnapshot => {
  return {
    todos: [
      {
        id: "1",
        content: "Task",
        status: "pending",
        priority: "medium",
      },
    ],
    incompleteCount: 1,
    resolvedInfo: {},
  };
};

describe("todo enforcer guards", () => {
  test("blocks when max failures reached", () => {
    const now = Date.now();
    const config = createTodoEnforcerConfig({
      now: () => now,
      maxConsecutiveFailures: 3,
    });

    const state = createState();
    state.consecutiveFailures = 3;
    state.lastInjectedAt = now;

    const decision = evaluateIdleGuards({
      config,
      state,
      snapshot: createSnapshot(),
      isStopped: false,
      hasRunningBackgroundTasks: false,
    });

    expect(decision).toEqual({ ok: false, reason: "max-failures" });
  });

  test("allows after failure reset window elapses", () => {
    const now = Date.now();
    const config = createTodoEnforcerConfig({
      now: () => now,
      maxConsecutiveFailures: 2,
      failureResetWindowMs: 1,
      continuationCooldownMs: 1,
    });

    const state = createState();
    state.consecutiveFailures = 2;
    state.lastInjectedAt = now - 100;

    const decision = evaluateIdleGuards({
      config,
      state,
      snapshot: createSnapshot(),
      isStopped: false,
      hasRunningBackgroundTasks: false,
    });

    expect(decision).toEqual({ ok: true });
    expect(state.consecutiveFailures).toBe(0);
  });

  test("blocks skipped agent", () => {
    const config = createTodoEnforcerConfig({
      skipAgents: ["compaction"],
    });

    const state = createState();
    const snapshot = createSnapshot();
    snapshot.resolvedInfo.agent = "compaction";

    const decision = evaluateIdleGuards({
      config,
      state,
      snapshot,
      isStopped: false,
      hasRunningBackgroundTasks: false,
    });

    expect(decision).toEqual({ ok: false, reason: "skipped-agent" });
  });

  test("normalizes skip agent aliases", () => {
    const config = createTodoEnforcerConfig({
      skipAgents: ["Prometheus (Planner)"],
    });

    const state = createState();
    const snapshot = createSnapshot();
    snapshot.resolvedInfo.agent = "prometheus";

    const decision = evaluateIdleGuards({
      config,
      state,
      snapshot,
      isStopped: false,
      hasRunningBackgroundTasks: false,
    });

    expect(decision).toEqual({ ok: false, reason: "skipped-agent" });
  });

  test("blocks when continuation is stopped", () => {
    const config = createTodoEnforcerConfig();

    const decision = evaluateIdleGuards({
      config,
      state: createState(),
      snapshot: createSnapshot(),
      isStopped: true,
      hasRunningBackgroundTasks: false,
    });

    expect(decision).toEqual({ ok: false, reason: "stop-state" });
  });
});
