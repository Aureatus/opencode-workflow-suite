import type { PluginInput } from "@opencode-ai/plugin";
import type { Event, Part, Todo } from "@opencode-ai/sdk";

import { createWorkflowSuitePlugin } from "../src";

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const ensure = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const pendingTodo = (): Todo => {
  return {
    id: "todo-1",
    content: "Implement feature",
    status: "pending",
    priority: "high",
  };
};

const textPart = (text: string): Part => {
  return {
    id: "part-1",
    sessionID: "integration-session",
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
}

const createHarness = (): Harness => {
  const promptCalls: Record<string, unknown>[] = [];
  const toastCalls: Record<string, unknown>[] = [];

  let todos: Todo[] = [pendingTodo()];
  let messages: { info: Record<string, unknown>; parts: Part[] }[] = [];

  const ctx = {
    directory: "/tmp/opencode-workflow-suite-integration",
    client: {
      session: {
        todo: () => Promise.resolve({ data: todos }),
        messages: () => Promise.resolve({ data: messages }),
        promptAsync: (payload: Record<string, unknown>) => {
          promptCalls.push(payload);
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
    setTodos: (value: Todo[]) => {
      todos = value;
    },
    setMessages: (
      value: { info: Record<string, unknown>; parts: Part[] }[]
    ) => {
      messages = value;
    },
  };
};

const idleEvent = (): Event => {
  return {
    type: "session.idle",
    properties: {
      sessionID: "integration-session",
    },
  } as Event;
};

const run = async (): Promise<void> => {
  const harness = createHarness();

  const pluginFactory = createWorkflowSuitePlugin({
    todoEnforcer: {
      countdownMs: 10,
      countdownGraceMs: 5,
      continuationCooldownMs: 120,
      abortWindowMs: 30,
    },
  });
  const hooks = await pluginFactory(harness.ctx);

  ensure(typeof hooks.event === "function", "event hook should exist");
  ensure(
    typeof hooks["chat.message"] === "function",
    "chat.message hook should exist"
  );
  ensure(
    typeof hooks.tool?.todo_enforcer_debug_ping === "object",
    "todo_enforcer_debug_ping tool should exist"
  );
  ensure(
    typeof hooks.tool?.repo_ensure_local === "object",
    "repo_ensure_local tool should exist"
  );

  await hooks.event?.({ event: idleEvent() });
  await sleep(25);
  ensure(harness.promptCalls.length === 1, "idle should inject continuation");

  await hooks.event?.({ event: idleEvent() });
  await sleep(40);
  ensure(
    harness.promptCalls.length === 1,
    "cooldown should block immediate reinjection"
  );

  await sleep(120);
  await hooks.event?.({ event: idleEvent() });
  await sleep(25);
  ensure(
    harness.promptCalls.length === 2,
    "reinjection should resume after cooldown"
  );

  await hooks.event?.({
    event: {
      type: "command.executed",
      properties: {
        name: "stop-continuation",
        sessionID: "integration-session",
        arguments: "",
        messageID: "msg-stop",
      },
    } as Event,
  });

  await sleep(140);
  await hooks.event?.({ event: idleEvent() });
  await sleep(25);
  ensure(
    harness.promptCalls.length === 2,
    "stop command should pause continuation"
  );

  await hooks["chat.message"]?.(
    {
      sessionID: "integration-session",
      agent: "sisyphus",
      messageID: "msg-resume",
    } as never,
    {
      parts: [textPart("resume")],
    } as never
  );

  await sleep(25);
  await hooks.event?.({ event: idleEvent() });
  await sleep(25);
  ensure(
    harness.promptCalls.length === 3,
    "normal user message should clear stop state"
  );

  harness.setMessages([
    {
      info: {
        id: "compaction-msg",
        role: "assistant",
        agent: "compaction",
      },
      parts: [],
    },
  ]);
  await sleep(25);
  await hooks.event?.({ event: idleEvent() });
  await sleep(25);
  ensure(
    harness.promptCalls.length === 3,
    "compaction-only context should stay skipped"
  );

  harness.setTodos([
    {
      id: "todo-1",
      content: "Done",
      status: "completed",
      priority: "high",
    },
  ]);
  await sleep(25);
  await hooks.event?.({ event: idleEvent() });
  await sleep(25);
  ensure(
    harness.promptCalls.length === 3,
    "completed todo list should not inject"
  );

  console.log("Integration test passed");
  console.log(
    JSON.stringify(
      {
        promptCalls: harness.promptCalls.length,
        toastCalls: harness.toastCalls.length,
      },
      null,
      2
    )
  );
};

await run();
