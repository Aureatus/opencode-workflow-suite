import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import type { PluginInput } from "@opencode-ai/plugin";
import type { Event } from "@opencode-ai/sdk";

import { createWorkflowNotifierConfig } from "../src/notifier/config";
import { createWorkflowNotifier } from "../src/notifier/notifier";

const flushAsync = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const sleep = async (ms: number): Promise<void> => {
  jest.advanceTimersByTime(ms);
  await flushAsync();
};

const createHarness = () => {
  const toastCalls: Array<{ variant: string; message: string }> = [];

  const ctx = {
    directory: "/tmp/workflow-suite",
    worktree: "/tmp/workflow-suite",
    project: {
      id: "project-1",
      name: "workflow-suite",
      git: false,
    },
    serverUrl: new URL("http://127.0.0.1:4096"),
    $: () => {
      throw new Error("shell not used in test");
    },
    client: {
      session: {
        get: () =>
          Promise.resolve({
            data: {
              id: "session-1",
              title: "Workflow test session",
            },
          }),
      },
      tui: {
        showToast: (payload: {
          body: { variant: string; message: string };
        }) => {
          toastCalls.push(payload.body);
          return Promise.resolve({ data: true });
        },
      },
    },
  } as unknown as PluginInput;

  return {
    ctx,
    toastCalls,
  };
};

const idleEvent = (sessionID: string): Event => {
  return {
    type: "session.idle",
    properties: {
      sessionID,
    },
  } as Event;
};

describe("workflow notifier", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test("notifies on terminal ready idle outcome", async () => {
    const harness = createHarness();
    const notifier = createWorkflowNotifier({
      ctx: harness.ctx,
      config: createWorkflowNotifierConfig({
        command: { enabled: false },
        settleMs: 10,
      }),
    });

    await notifier.onEvent({ event: idleEvent("session-1") });
    notifier.onEnforcerLifecycle({
      kind: "idle_skipped",
      reason: "todo-complete",
      sessionID: "session-1",
    });

    await sleep(40);
    expect(harness.toastCalls).toHaveLength(1);
    expect(harness.toastCalls[0]?.message).toContain("Session ready");

    notifier.dispose();
  });

  test("does not notify when enforcer continues session", async () => {
    const harness = createHarness();
    const notifier = createWorkflowNotifier({
      ctx: harness.ctx,
      config: createWorkflowNotifierConfig({
        command: { enabled: false },
        settleMs: 10,
      }),
    });

    await notifier.onEvent({ event: idleEvent("session-1") });
    notifier.onEnforcerLifecycle({
      kind: "injected",
      sessionID: "session-1",
    });

    await sleep(40);
    expect(harness.toastCalls).toHaveLength(0);

    notifier.dispose();
  });

  test("notifies on permission events", async () => {
    const harness = createHarness();
    const notifier = createWorkflowNotifier({
      ctx: harness.ctx,
      config: createWorkflowNotifierConfig({
        command: { enabled: false },
      }),
    });

    await notifier.onEvent({
      event: {
        type: "permission.updated",
        properties: {
          sessionID: "session-1",
        },
      } as Event,
    });

    expect(harness.toastCalls).toHaveLength(1);
    expect(harness.toastCalls[0]?.message).toContain("Permission required");

    notifier.dispose();
  });

  test("notifies on question tool execution", async () => {
    const harness = createHarness();
    const notifier = createWorkflowNotifier({
      ctx: harness.ctx,
      config: createWorkflowNotifierConfig({
        command: { enabled: false },
      }),
    });

    await notifier.onToolExecuteBefore({
      sessionID: "session-1",
      tool: "question",
    });

    expect(harness.toastCalls).toHaveLength(1);
    expect(harness.toastCalls[0]?.message).toContain("Question requires input");

    notifier.dispose();
  });

  test("suppresses notifications when focus command reports focused", async () => {
    const harness = createHarness();
    const notifier = createWorkflowNotifier({
      ctx: harness.ctx,
      config: createWorkflowNotifierConfig({
        focusCommand: {
          enabled: true,
          path: "/bin/true",
          args: [],
        },
        command: { enabled: false },
        suppressWhenFocused: true,
      }),
    });

    await notifier.onEvent({
      event: {
        type: "permission.updated",
        properties: {
          sessionID: "session-1",
        },
      } as Event,
    });

    expect(harness.toastCalls).toHaveLength(0);
    notifier.dispose();
  });

  test("suppresses notifications during quiet hours", async () => {
    const harness = createHarness();
    const now = new Date("2026-01-01T23:30:00.000Z").getTime();
    const notifier = createWorkflowNotifier({
      ctx: harness.ctx,
      config: createWorkflowNotifierConfig({
        command: { enabled: false },
        now: () => now,
        quietHours: {
          enabled: true,
          start: "22:00",
          end: "08:00",
        },
      }),
    });

    await notifier.onEvent({
      event: {
        type: "permission.updated",
        properties: {
          sessionID: "session-1",
        },
      } as Event,
    });

    expect(harness.toastCalls).toHaveLength(0);
    notifier.dispose();
  });
});
