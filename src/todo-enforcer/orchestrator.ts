import type { PluginInput } from "@opencode-ai/plugin";
import type { Event, Part, Todo } from "@opencode-ai/sdk";
import {
  extractMessageRoleFromEvent,
  extractSessionIDFromEvent,
  isRecord,
} from "../workflow-core/event-utils";
import {
  isAbortLikeError,
  isLastAssistantMessageAborted,
} from "./abort-detection";
import { injectContinuation } from "./continuation";
import { cancelCountdown, startCountdown } from "./countdown";
import { evaluateIdleGuards } from "./guards";
import type { TodoEnforcerLifecycleEvent } from "./lifecycle";
import { unwrapSdkResponse } from "./response";
import { createSessionStateStore } from "./session-state";
import { createTodoEnforcerTelemetry } from "./telemetry";
import { getIncompleteTodoCount } from "./todo";
import type {
  PromptMessage,
  SessionAgentInfo,
  TodoEnforcerConfig,
} from "./types";

interface OrchestratorArgs {
  ctx: PluginInput;
  config: TodoEnforcerConfig;
  onLifecycleEvent?: (event: TodoEnforcerLifecycleEvent) => void;
  stopState: {
    isStopped: (sessionID: string) => boolean;
    setStopped: (sessionID: string, value: boolean) => void;
    clear: (sessionID: string) => void;
  };
}

const NO_OP = (_error: unknown): undefined => {
  return undefined;
};

const extractResolvedInfo = (messages: PromptMessage[]): SessionAgentInfo => {
  let sawCompaction = false;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const info = messages[index].info;
    if (!info) {
      continue;
    }

    if (info.agent?.toLowerCase() === "compaction") {
      sawCompaction = true;
      continue;
    }

    if (info.agent || info.model) {
      return {
        agent: info.agent,
        model: info.model,
      };
    }

    if (info.providerID && info.modelID) {
      return {
        agent: info.agent,
        model: {
          providerID: info.providerID,
          modelID: info.modelID,
        },
      };
    }
  }

  if (sawCompaction) {
    return { agent: "compaction" };
  }

  return {};
};

const extractUserText = (parts: Part[]): string => {
  const textParts = parts.filter(
    (part): part is Extract<Part, { type: "text" }> => {
      return part.type === "text";
    }
  );
  const chunks: string[] = [];
  for (const part of textParts) {
    chunks.push(part.text);
  }
  return chunks.join("\n").trim();
};

export const createTodoEnforcerOrchestrator = ({
  ctx,
  config,
  onLifecycleEvent,
  stopState,
}: OrchestratorArgs) => {
  const states = createSessionStateStore(config);
  const telemetry = createTodoEnforcerTelemetry();

  const emit = (input: TodoEnforcerLifecycleEvent): void => {
    telemetry.log({
      kind: input.kind,
      metadata: input.metadata,
      reason: input.reason,
      sessionID: input.sessionID,
    });
    onLifecycleEvent?.(input);
  };

  const cancelForActivity = (sessionID: string): void => {
    const state = states.get(sessionID);
    const hadCountdown = Boolean(state.countdownStartedAt);
    if (state.countdownStartedAt) {
      emit({
        kind: "countdown_cancelled",
        metadata: {
          source: "activity",
        },
        reason: "activity",
        sessionID,
      });
    }
    cancelCountdown(state);
    if (hadCountdown) {
      state.userActivityAt = config.now();
    }
    states.touch(sessionID);
  };

  const cancelCountdownForSession = (sessionID: string): void => {
    const state = states.get(sessionID);
    const hadCountdown = Boolean(state.countdownStartedAt);
    if (state.countdownStartedAt) {
      emit({
        kind: "countdown_cancelled",
        metadata: {
          source: "session_event",
        },
        reason: "session_event",
        sessionID,
      });
    }
    cancelCountdown(state);
    if (hadCountdown) {
      state.userActivityAt = config.now();
    }
    states.touch(sessionID);
  };

  const handleIdle = async (sessionID: string): Promise<void> => {
    const state = states.get(sessionID);
    states.prune();
    emit({ kind: "idle_seen", sessionID });

    if (
      state.userActivityAt &&
      config.now() - state.userActivityAt < config.countdownGraceMs
    ) {
      emit({
        kind: "idle_skipped",
        reason: "post-cancel-grace",
        sessionID,
      });
      return;
    }

    let todos: Todo[] = [];
    try {
      const todoResponse = await ctx.client.session.todo({
        path: { id: sessionID },
      });
      todos = unwrapSdkResponse(todoResponse, [] as Todo[]);
    } catch (_error) {
      return;
    }

    let messages: PromptMessage[] = [];
    try {
      const messageResponse = await ctx.client.session.messages({
        path: { id: sessionID },
        query: { directory: ctx.directory },
      });
      messages = unwrapSdkResponse(messageResponse, [] as PromptMessage[]);
    } catch (_error) {
      return;
    }

    if (isLastAssistantMessageAborted(messages)) {
      state.abortDetectedAt = config.now();
    }

    const resolvedInfo = extractResolvedInfo(messages);
    const snapshot = {
      todos,
      incompleteCount: getIncompleteTodoCount(todos),
      resolvedInfo,
    };

    const decision = evaluateIdleGuards({
      state,
      snapshot,
      config,
      isStopped: stopState.isStopped(sessionID),
      hasRunningBackgroundTasks:
        config.hasRunningBackgroundTasks?.(sessionID) ?? false,
    });

    if (!decision.ok) {
      emit({
        kind: "idle_skipped",
        reason: decision.reason,
        sessionID,
      });
      return;
    }

    emit({ kind: "countdown_started", sessionID });
    startCountdown({
      ctx,
      config,
      state,
      sessionID,
      incompleteCount: snapshot.incompleteCount,
      onElapsed: async () => {
        const stateAfterCountdown = states.get(sessionID);
        if (
          stateAfterCountdown.userActivityAt &&
          config.now() - stateAfterCountdown.userActivityAt <
            config.countdownGraceMs
        ) {
          return;
        }

        const result = await injectContinuation({
          ctx,
          config,
          sessionID,
          state: stateAfterCountdown,
          resolvedInfo,
        });

        emit({
          kind: result.status === "injected" ? "injected" : "injection_skipped",
          reason: result.status,
          sessionID,
        });
      },
    });
  };

  const handleSessionError = (sessionID: string, event: Event): void => {
    const state = states.get(sessionID);
    if (
      event.type === "session.error" &&
      isAbortLikeError(event.properties.error)
    ) {
      state.abortDetectedAt = config.now();
      emit({ kind: "abort_detected", sessionID });
    } else {
      state.abortDetectedAt = undefined;
      emit({ kind: "non_abort_error", sessionID });
    }
    cancelCountdownForSession(sessionID);
  };

  const handleCommandExecuted = (sessionID: string, event: Event): void => {
    if (event.type !== "command.executed" || !isRecord(event.properties)) {
      return;
    }

    if (event.properties.name === config.stopCommand.replace("/", "")) {
      stopState.setStopped(sessionID, true);
      emit({ kind: "stop_set_command", sessionID });
    }
  };

  const shouldIgnoreUserActivity = (
    sessionID: string,
    event: Event
  ): boolean => {
    const role = extractMessageRoleFromEvent(event);
    if (role !== "user") {
      return false;
    }

    const state = states.get(sessionID);
    return Boolean(
      state.countdownStartedAt &&
        config.now() - state.countdownStartedAt < config.countdownGraceMs
    );
  };

  const onEvent = async (input: { event: Event }): Promise<void> => {
    if (!config.enabled) {
      return;
    }

    const { event } = input;
    const sessionID = extractSessionIDFromEvent(event);
    if (!sessionID) {
      return;
    }

    switch (event.type) {
      case "session.idle": {
        await handleIdle(sessionID);
        return;
      }
      case "session.deleted": {
        states.clear(sessionID);
        stopState.clear(sessionID);
        emit({ kind: "session_deleted", sessionID });
        return;
      }
      case "session.error": {
        handleSessionError(sessionID, event);
        return;
      }
      case "command.executed": {
        handleCommandExecuted(sessionID, event);
        return;
      }
      case "message.updated": {
        if (shouldIgnoreUserActivity(sessionID, event)) {
          return;
        }
        cancelForActivity(sessionID);
        return;
      }
      case "message.part.updated":
      case "session.status": {
        cancelForActivity(sessionID);
        return;
      }
      default: {
        return;
      }
    }
  };

  const onChatMessage = async (
    input: { sessionID: string },
    output: { parts: Part[] }
  ): Promise<void> => {
    if (!config.enabled) {
      return;
    }

    const text = extractUserText(output.parts);
    emit({ kind: "chat_message_seen", sessionID: input.sessionID });
    if (text === config.stopCommand) {
      stopState.setStopped(input.sessionID, true);
      emit({ kind: "stop_set_chat", sessionID: input.sessionID });
      await ctx.client.tui
        .showToast({
          body: {
            variant: "warning",
            message: "Todo continuation paused for this session.",
          },
        })
        .catch(NO_OP);
      return;
    }

    if (stopState.isStopped(input.sessionID)) {
      stopState.setStopped(input.sessionID, false);
      emit({ kind: "stop_cleared_chat", sessionID: input.sessionID });
      await ctx.client.tui
        .showToast({
          body: {
            variant: "info",
            message: "Todo continuation resumed for this session.",
          },
        })
        .catch(NO_OP);
    }
  };

  const onToolExecuteBefore = (input: { sessionID: string }): void => {
    if (!config.enabled) {
      return;
    }
    cancelForActivity(input.sessionID);
  };

  const onToolExecuteAfter = (input: { sessionID: string }): void => {
    if (!config.enabled) {
      return;
    }
    cancelForActivity(input.sessionID);
  };

  return {
    onEvent,
    onChatMessage,
    onToolExecuteBefore,
    onToolExecuteAfter,
  };
};
