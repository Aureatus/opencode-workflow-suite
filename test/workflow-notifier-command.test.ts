import { describe, expect, test } from "bun:test";
import type { PluginInput } from "@opencode-ai/plugin";
import type { Event } from "@opencode-ai/sdk";

import { createWorkflowNotifierConfig } from "../src/notifier/config";
import { createWorkflowNotifier } from "../src/notifier/notifier";

interface SpawnCall {
  command: string;
  args: string[];
  options: unknown;
}

interface MockSpawnPlan {
  code?: number;
  stderr?: string;
  stdout?: string;
}

const createEmitter = () => {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  return {
    emit: (event: string, ...args: unknown[]): void => {
      const handlers = listeners.get(event) ?? [];
      for (const handler of handlers) {
        handler(...args);
      }
    },
    on: (event: string, callback: (...args: unknown[]) => void) => {
      const existing = listeners.get(event) ?? [];
      existing.push(callback);
      listeners.set(event, existing);
      return undefined;
    },
  };
};

const createSpawnMock = (plans: Record<string, MockSpawnPlan>) => {
  const calls: SpawnCall[] = [];

  const spawnMock = (
    command: string,
    args: string[],
    options: unknown
  ): unknown => {
    calls.push({ args, command, options });

    const stdoutEmitter = createEmitter();
    const stderrEmitter = createEmitter();
    const processEmitter = createEmitter();

    queueMicrotask(() => {
      const plan = plans[command] ?? { code: 0 };
      if (plan.stdout) {
        stdoutEmitter.emit("data", Buffer.from(plan.stdout));
      }
      if (plan.stderr) {
        stderrEmitter.emit("data", Buffer.from(plan.stderr));
      }
      processEmitter.emit("close", plan.code ?? 0);
    });

    return {
      on: processEmitter.on,
      stderr: {
        on: stderrEmitter.on,
      },
      stdout: {
        on: stdoutEmitter.on,
      },
      unref: () => undefined,
    };
  };

  return {
    calls,
    spawnMock,
  };
};

const createHarness = () => {
  const toastCalls: Array<{ variant: string; message: string }> = [];

  const ctx = {
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
    directory: "/tmp/workflow-suite",
    project: {
      git: false,
      id: "project-1",
      name: "workflow-suite",
    },
    serverUrl: new URL("http://127.0.0.1:4096"),
    worktree: "/tmp/workflow-suite",
    $: () => {
      throw new Error("shell not used in command tests");
    },
  } as unknown as PluginInput;

  return {
    ctx,
    toastCalls,
  };
};

describe("workflow notifier command behavior", () => {
  test("renders placeholders into notification command args", async () => {
    const harness = createHarness();
    const { calls, spawnMock } = createSpawnMock({
      "notify-cmd": { code: 0 },
    });

    const notifier = createWorkflowNotifier({
      config: createWorkflowNotifierConfig({
        command: {
          args: [
            "{event}",
            "{message}",
            "{project}",
            "{reason}",
            "{sessionID}",
            "{sessionTitle}",
          ],
          enabled: true,
          path: "notify-cmd",
        },
      }),
      ctx: harness.ctx,
      spawnProcess: spawnMock as never,
    });

    await notifier.onEvent({
      event: {
        type: "permission.updated",
        properties: {
          sessionID: "session-1",
        },
      } as Event,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      args: [
        "permission",
        "Permission required in Workflow test session",
        "workflow-suite",
        "",
        "session-1",
        "Workflow test session",
      ],
      command: "notify-cmd",
      options: {
        detached: true,
        stdio: "ignore",
      },
    });
    notifier.dispose();
  });

  test("cooldown dedupes repeated command notifications", async () => {
    const harness = createHarness();
    const { calls, spawnMock } = createSpawnMock({
      "notify-cmd": { code: 0 },
    });

    const notifier = createWorkflowNotifier({
      config: createWorkflowNotifierConfig({
        command: {
          enabled: true,
          path: "notify-cmd",
        },
        cooldownMs: 10_000,
        now: () => 1000,
      }),
      ctx: harness.ctx,
      spawnProcess: spawnMock as never,
    });

    const event = {
      event: {
        type: "permission.updated",
        properties: {
          sessionID: "session-1",
        },
      } as Event,
    };
    await notifier.onEvent(event);
    await notifier.onEvent(event);

    expect(calls).toHaveLength(1);
    expect(harness.toastCalls.length).toBeGreaterThan(0);
    notifier.dispose();
  });

  test("focus options do not suppress notifications", async () => {
    const harness = createHarness();
    const { calls, spawnMock } = createSpawnMock({
      "focus-cmd": { code: 1 },
      "notify-cmd": { code: 0 },
    });

    const notifier = createWorkflowNotifier({
      config: createWorkflowNotifierConfig({
        command: {
          enabled: true,
          path: "notify-cmd",
        },
        focusCommand: {
          enabled: true,
          path: "focus-cmd",
        },
        suppressWhenFocused: true,
      }),
      ctx: harness.ctx,
      spawnProcess: spawnMock as never,
    });

    await notifier.onEvent({
      event: {
        type: "permission.updated",
        properties: {
          sessionID: "session-1",
        },
      } as Event,
    });

    expect(calls.some((call) => call.command === "focus-cmd")).toBe(false);
    expect(calls.some((call) => call.command === "notify-cmd")).toBe(true);
    notifier.dispose();
  });
});
