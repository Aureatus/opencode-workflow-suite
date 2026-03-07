import type { Plugin } from "@opencode-ai/plugin";
import {
  createWorkflowNotifierConfig,
  type WorkflowNotifierOptions,
} from "./notifier/config";
import { createWorkflowNotifier } from "./notifier/notifier";
import {
  createTodoEnforcerConfig,
  type TodoEnforcerOptions,
} from "./todo-enforcer/config";
import { todoEnforcerDebugPingTool } from "./todo-enforcer/debug-tool";
import { createTodoEnforcerOrchestrator } from "./todo-enforcer/orchestrator";
import { createStopStateStore } from "./todo-enforcer/stop-state";

export type { WorkflowNotifierOptions } from "./notifier/config";
export type { TodoEnforcerOptions } from "./todo-enforcer/config";

export interface TodoWorkflowOptions {
  todoEnforcer?: TodoEnforcerOptions;
  notifier?: WorkflowNotifierOptions;
}

export type WorkflowSuiteOptions = TodoWorkflowOptions;

type LegacyOrWorkflowOptions = TodoWorkflowOptions | TodoEnforcerOptions;

const isWorkflowOptions = (
  value: LegacyOrWorkflowOptions | undefined
): value is TodoWorkflowOptions => {
  if (!value) {
    return false;
  }

  return "todoEnforcer" in value || "notifier" in value;
};

const normalizeOptions = (
  options?: LegacyOrWorkflowOptions
): TodoWorkflowOptions | undefined => {
  if (!options) {
    return undefined;
  }

  if (isWorkflowOptions(options)) {
    return options;
  }

  return {
    todoEnforcer: options,
  };
};

const createHooks = (
  input: Parameters<Plugin>[0],
  options?: TodoWorkflowOptions
) => {
  const config = createTodoEnforcerConfig(options?.todoEnforcer);
  const notifierConfig = createWorkflowNotifierConfig(options?.notifier);
  const stopState = createStopStateStore();
  const notifier = createWorkflowNotifier({
    config: notifierConfig,
    ctx: input,
  });
  const orchestrator = createTodoEnforcerOrchestrator({
    ctx: input,
    config,
    onLifecycleEvent: notifier.onEnforcerLifecycle,
    stopState,
  });

  return {
    tool: {
      todo_enforcer_debug_ping: todoEnforcerDebugPingTool,
    },
    event: async (payload: {
      event: Parameters<typeof orchestrator.onEvent>[0]["event"];
    }) => {
      await orchestrator.onEvent(payload);
      await notifier.onEvent(payload);
    },
    "chat.message": async (
      payload: Parameters<typeof orchestrator.onChatMessage>[0],
      output: Parameters<typeof orchestrator.onChatMessage>[1]
    ) => {
      await orchestrator.onChatMessage(payload, output);
    },
    "tool.execute.before": async (
      payload: Parameters<typeof notifier.onToolExecuteBefore>[0]
    ) => {
      await orchestrator.onToolExecuteBefore(payload);
      await notifier.onToolExecuteBefore(payload);
    },
    "tool.execute.after": async (
      payload: Parameters<typeof orchestrator.onToolExecuteAfter>[0]
    ) => {
      await orchestrator.onToolExecuteAfter(payload);
    },
    "permission.ask": async (
      inputPayload: Parameters<typeof notifier.onPermissionAsk>[0]
    ) => {
      await notifier.onPermissionAsk(inputPayload);
    },
  };
};

export const WorkflowSuitePlugin: Plugin = (input) => {
  return Promise.resolve(createHooks(input));
};

export const createWorkflowSuitePlugin = (
  options?: LegacyOrWorkflowOptions
): Plugin => {
  return (input) => {
    return Promise.resolve(createHooks(input, normalizeOptions(options)));
  };
};

export const TodoEnforcerPlugin = WorkflowSuitePlugin;
export const createTodoEnforcerPlugin = createWorkflowSuitePlugin;

export default WorkflowSuitePlugin;
