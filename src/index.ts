import type { Plugin } from "@opencode-ai/plugin";
import { createWorkflowNotifierConfig } from "./notifier/config";
import { createWorkflowNotifier } from "./notifier/notifier";
import { repoEnsureLocalTool } from "./repo-local/tools/repo-ensure-local";
import { createTodoEnforcerConfig } from "./todo-enforcer/config";
import { todoEnforcerDebugPingTool } from "./todo-enforcer/debug-tool";
import { createTodoEnforcerOrchestrator } from "./todo-enforcer/orchestrator";
import { createStopStateStore } from "./todo-enforcer/stop-state";
import {
  loadWorkflowSuiteOptionsFromFile,
  mergeWorkflowSuiteOptions,
} from "./workflow-core/file-config";
import type { WorkflowSuiteOptions as WorkflowSuiteOptionsType } from "./workflow-core/workflow-suite-options";

export type { WorkflowNotifierOptions } from "./notifier/config";
export type { TodoEnforcerOptions } from "./todo-enforcer/config";
export type {
  WorkflowSuiteModulesOptions,
  WorkflowSuiteOptions,
} from "./workflow-core/workflow-suite-options";

export type TodoWorkflowOptions = WorkflowSuiteOptionsType;

const resolveModuleEnabled = (
  optionValue: boolean | undefined,
  defaultValue = true
): boolean => {
  return optionValue ?? defaultValue;
};

const createHooks = (
  input: Parameters<Plugin>[0],
  options?: WorkflowSuiteOptionsType
) => {
  const fileOptions = loadWorkflowSuiteOptionsFromFile(input);
  const resolvedOptions = mergeWorkflowSuiteOptions(fileOptions, options);

  const todoModuleEnabled = resolveModuleEnabled(
    resolvedOptions?.modules?.todoEnforcer
  );
  const notifierModuleEnabled = resolveModuleEnabled(
    resolvedOptions?.modules?.notifier
  );
  const repoLocalModuleEnabled = resolveModuleEnabled(
    resolvedOptions?.modules?.repoLocal
  );

  const config = createTodoEnforcerConfig(resolvedOptions?.todoEnforcer);
  config.enabled = config.enabled && todoModuleEnabled;
  const notifierConfig = createWorkflowNotifierConfig(
    resolvedOptions?.notifier
  );
  notifierConfig.enabled = notifierConfig.enabled && notifierModuleEnabled;
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

  const tool = {
    todo_enforcer_debug_ping: todoEnforcerDebugPingTool,
    ...(repoLocalModuleEnabled
      ? {
          repo_ensure_local: repoEnsureLocalTool,
        }
      : {}),
  };

  return {
    tool,
    event: async (payload: {
      event: Parameters<typeof orchestrator.onEvent>[0]["event"];
    }) => {
      await Promise.all([
        orchestrator.onEvent(payload),
        notifier.onEvent(payload),
      ]);
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
  options?: WorkflowSuiteOptionsType
): Plugin => {
  return (input) => {
    return Promise.resolve(createHooks(input, options));
  };
};

export default WorkflowSuitePlugin;
