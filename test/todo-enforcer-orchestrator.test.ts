import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import type { PluginInput } from "@opencode-ai/plugin";
import type { Event, Part, Todo } from "@opencode-ai/sdk";

import { createTodoEnforcerConfig } from "../src/todo-enforcer/config";
import { createTodoEnforcerOrchestrator } from "../src/todo-enforcer/orchestrator";
import { createStopStateStore } from "../src/todo-enforcer/stop-state";

const flushAsync = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const sleep = async (ms: number): Promise<void> => {
  jest.advanceTimersByTime(ms);
  await flushAsync();
};

const pendingTodo = (): Todo => {
  return {
    id: "todo-1",
    content: "Do a thing",
    status: "pending",
    priority: "high",
  };
};

const textPart = (text: string): Part => {
  return {
    id: "part-1",
    sessionID: "session-1",
    messageID: "msg-1",
    type: "text",
    text,
  };
};

interface Harness {
  ctx: PluginInput;
  promptCalls: Record<string, unknown>[];
  toastCalls: Record<string, unknown>[];
  setTodos: (value: Todo[]) => void;
  setMessages: (
    value: { info: Record<string, unknown>; parts: Part[] }[]
  ) => void;
  failNextPrompts: (count: number) => void;
}

const createHarness = (): Harness => {
  let todos: Todo[] = [pendingTodo()];
  let messages: { info: Record<string, unknown>; parts: Part[] }[] = [];
  let failureBudget = 0;

  const promptCalls: Record<string, unknown>[] = [];
  const toastCalls: Record<string, unknown>[] = [];

  const ctx = {
    directory: "/tmp/project",
    client: {
      session: {
        todo: () => Promise.resolve({ data: todos }),
        messages: () => Promise.resolve({ data: messages }),
        promptAsync: (payload: Record<string, unknown>) => {
          promptCalls.push(payload);
          if (failureBudget > 0) {
            failureBudget -= 1;
            return Promise.reject(new Error("prompt failure"));
          }
          return Promise.resolve({ data: undefined });
        },
      },
      tui: {
        showToast: (payload: Record<string, unknown>) => {
          toastCalls.push(payload);
          return Promise.resolve({ data: undefined });
        },
      },
    },
  } as unknown as PluginInput;

  return {
    ctx,
    promptCalls,
    toastCalls,
    setTodos: (value) => {
      todos = value;
    },
    setMessages: (value) => {
      messages = value;
    },
    failNextPrompts: (count) => {
      failureBudget = count;
    },
  };
};

const idleEvent = (sessionID = "session-1"): Event => {
  return {
    type: "session.idle",
    properties: { sessionID },
  } as Event;
};

describe("todo enforcer orchestrator", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test("injects continuation after idle countdown", async () => {
    const harness = createHarness();
    const config = createTodoEnforcerConfig({
      countdownMs: 10,
      countdownGraceMs: 0,
      continuationCooldownMs: 0,
    });

    const orchestrator = createTodoEnforcerOrchestrator({
      ctx: harness.ctx,
      config,
      stopState: createStopStateStore(),
    });

    await orchestrator.onEvent({ event: idleEvent() });
    await sleep(30);

    expect(harness.promptCalls.length).toBe(1);
  });

  test("does not inject when all todos are complete", async () => {
    const harness = createHarness();
    harness.setTodos([
      {
        id: "todo-1",
        content: "Done",
        status: "completed",
        priority: "high",
      },
    ]);

    const orchestrator = createTodoEnforcerOrchestrator({
      ctx: harness.ctx,
      config: createTodoEnforcerConfig({ countdownMs: 10 }),
      stopState: createStopStateStore(),
    });

    await orchestrator.onEvent({ event: idleEvent() });
    await sleep(30);

    expect(harness.promptCalls).toHaveLength(0);
  });

  test("does not inject while background tasks are running", async () => {
    const harness = createHarness();
    const orchestrator = createTodoEnforcerOrchestrator({
      ctx: harness.ctx,
      config: createTodoEnforcerConfig({
        countdownMs: 10,
        hasRunningBackgroundTasks: () => true,
      }),
      stopState: createStopStateStore(),
    });

    await orchestrator.onEvent({ event: idleEvent() });
    await sleep(30);

    expect(harness.promptCalls).toHaveLength(0);
  });

  test("cancels countdown on user activity after grace period", async () => {
    const harness = createHarness();
    const orchestrator = createTodoEnforcerOrchestrator({
      ctx: harness.ctx,
      config: createTodoEnforcerConfig({
        countdownMs: 40,
        countdownGraceMs: 10,
        continuationCooldownMs: 0,
      }),
      stopState: createStopStateStore(),
    });

    await orchestrator.onEvent({ event: idleEvent() });
    await sleep(20);
    await orchestrator.onEvent({
      event: {
        type: "message.updated",
        properties: { info: { sessionID: "session-1", role: "user" } },
      } as Event,
    });
    await sleep(60);

    expect(harness.promptCalls).toHaveLength(0);
  });

  test("ignores user activity within grace period", async () => {
    const harness = createHarness();
    const orchestrator = createTodoEnforcerOrchestrator({
      ctx: harness.ctx,
      config: createTodoEnforcerConfig({
        countdownMs: 10,
        countdownGraceMs: 100,
        continuationCooldownMs: 0,
      }),
      stopState: createStopStateStore(),
    });

    await orchestrator.onEvent({ event: idleEvent() });
    await sleep(5);
    await orchestrator.onEvent({
      event: {
        type: "message.updated",
        properties: { info: { sessionID: "session-1", role: "user" } },
      } as Event,
    });
    await sleep(100);

    expect(harness.promptCalls).toHaveLength(1);
  });

  test("cancels countdown when tools execute", async () => {
    const harness = createHarness();
    const orchestrator = createTodoEnforcerOrchestrator({
      ctx: harness.ctx,
      config: createTodoEnforcerConfig({
        countdownMs: 30,
        countdownGraceMs: 0,
      }),
      stopState: createStopStateStore(),
    });

    await orchestrator.onEvent({ event: idleEvent() });
    await sleep(5);
    await orchestrator.onToolExecuteBefore({ sessionID: "session-1" });
    await sleep(40);

    expect(harness.promptCalls).toHaveLength(0);
  });

  test("abort errors block injection within abort window", async () => {
    const harness = createHarness();
    const orchestrator = createTodoEnforcerOrchestrator({
      ctx: harness.ctx,
      config: createTodoEnforcerConfig({
        countdownMs: 10,
        abortWindowMs: 40,
        continuationCooldownMs: 0,
      }),
      stopState: createStopStateStore(),
    });

    await orchestrator.onEvent({
      event: {
        type: "session.error",
        properties: {
          sessionID: "session-1",
          error: { name: "MessageAbortedError" },
        },
      } as Event,
    });
    await orchestrator.onEvent({ event: idleEvent() });
    await sleep(30);

    expect(harness.promptCalls).toHaveLength(0);
  });

  test("non-abort errors do not block injection", async () => {
    const harness = createHarness();
    const orchestrator = createTodoEnforcerOrchestrator({
      ctx: harness.ctx,
      config: createTodoEnforcerConfig({
        countdownMs: 10,
        continuationCooldownMs: 0,
      }),
      stopState: createStopStateStore(),
    });

    await orchestrator.onEvent({
      event: {
        type: "session.error",
        properties: {
          sessionID: "session-1",
          error: { name: "NetworkError", message: "network unreachable" },
        },
      } as unknown as Event,
    });
    await orchestrator.onEvent({ event: idleEvent() });
    await sleep(25);

    expect(harness.promptCalls).toHaveLength(1);
  });

  test("applies cooldown between injections", async () => {
    const harness = createHarness();
    const orchestrator = createTodoEnforcerOrchestrator({
      ctx: harness.ctx,
      config: createTodoEnforcerConfig({
        countdownMs: 5,
        continuationCooldownMs: 30,
      }),
      stopState: createStopStateStore(),
    });

    await orchestrator.onEvent({ event: idleEvent() });
    await sleep(15);
    await orchestrator.onEvent({ event: idleEvent() });
    await sleep(15);

    expect(harness.promptCalls).toHaveLength(1);

    await sleep(35);
    await orchestrator.onEvent({ event: idleEvent() });
    await sleep(15);

    expect(harness.promptCalls).toHaveLength(2);
  });

  test("locks out after max consecutive failures and resumes after reset", async () => {
    const harness = createHarness();
    harness.failNextPrompts(3);

    const orchestrator = createTodoEnforcerOrchestrator({
      ctx: harness.ctx,
      config: createTodoEnforcerConfig({
        countdownMs: 5,
        continuationCooldownMs: 0,
        maxConsecutiveFailures: 2,
        failureResetWindowMs: 120,
      }),
      stopState: createStopStateStore(),
    });

    await orchestrator.onEvent({ event: idleEvent() });
    await sleep(25);
    await orchestrator.onEvent({ event: idleEvent() });
    await sleep(25);

    expect(harness.promptCalls).toHaveLength(2);

    await sleep(25);
    await orchestrator.onEvent({ event: idleEvent() });
    await sleep(25);

    expect(harness.promptCalls).toHaveLength(2);

    await sleep(130);
    await orchestrator.onEvent({ event: idleEvent() });
    await sleep(25);

    expect(harness.promptCalls).toHaveLength(3);
  });

  test("supports stop command event and clears on next user message", async () => {
    const harness = createHarness();
    const stopState = createStopStateStore();
    const orchestrator = createTodoEnforcerOrchestrator({
      ctx: harness.ctx,
      config: createTodoEnforcerConfig({
        countdownMs: 10,
        continuationCooldownMs: 0,
      }),
      stopState,
    });

    await orchestrator.onEvent({
      event: {
        type: "command.executed",
        properties: {
          name: "stop-continuation",
          sessionID: "session-1",
          arguments: "",
          messageID: "message-1",
        },
      } as Event,
    });

    await orchestrator.onEvent({ event: idleEvent() });
    await sleep(20);
    expect(stopState.isStopped("session-1")).toBe(true);
    expect(harness.promptCalls).toHaveLength(0);

    await orchestrator.onChatMessage(
      { sessionID: "session-1" },
      { parts: [textPart("continue work")] }
    );

    await orchestrator.onEvent({ event: idleEvent() });
    await sleep(20);

    expect(stopState.isStopped("session-1")).toBe(false);
    expect(harness.promptCalls).toHaveLength(1);
  });

  test("reuses agent context before compaction messages", async () => {
    const harness = createHarness();
    harness.setMessages([
      {
        info: {
          id: "msg-1",
          role: "assistant",
          agent: "sisyphus",
          providerID: "anthropic",
          modelID: "claude-sonnet-4-6",
        },
        parts: [],
      },
      {
        info: {
          id: "msg-2",
          role: "assistant",
          agent: "compaction",
        },
        parts: [],
      },
    ]);

    const orchestrator = createTodoEnforcerOrchestrator({
      ctx: harness.ctx,
      config: createTodoEnforcerConfig({
        countdownMs: 10,
        continuationCooldownMs: 0,
      }),
      stopState: createStopStateStore(),
    });

    await orchestrator.onEvent({ event: idleEvent() });
    await sleep(25);

    expect(harness.promptCalls).toHaveLength(1);
    const firstCall = harness.promptCalls[0];
    const body = firstCall.body as { agent?: string };
    expect(body.agent).toBe("sisyphus");
  });

  test("skips when only compaction agent context exists", async () => {
    const harness = createHarness();
    harness.setMessages([
      {
        info: {
          id: "msg-2",
          role: "assistant",
          agent: "compaction",
        },
        parts: [],
      },
    ]);

    const orchestrator = createTodoEnforcerOrchestrator({
      ctx: harness.ctx,
      config: createTodoEnforcerConfig({
        countdownMs: 10,
        continuationCooldownMs: 0,
      }),
      stopState: createStopStateStore(),
    });

    await orchestrator.onEvent({ event: idleEvent() });
    await sleep(25);

    expect(harness.promptCalls).toHaveLength(0);
  });
});
