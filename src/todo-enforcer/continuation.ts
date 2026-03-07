import type { PluginInput } from "@opencode-ai/plugin";
import type { Todo } from "@opencode-ai/sdk";

import { INTERNAL_INITIATOR_MARKER } from "./constants";
import { unwrapSdkResponse } from "./response";
import { getIncompleteTodoCount } from "./todo";
import type {
  SessionAgentInfo,
  SessionState,
  TodoEnforcerConfig,
} from "./types";

const swallowError = (_error: unknown): undefined => {
  return undefined;
};

export type ContinuationResult =
  | { status: "injected" }
  | { status: "skipped-no-todos" }
  | { status: "failed" };

export const injectContinuation = async (args: {
  ctx: PluginInput;
  config: TodoEnforcerConfig;
  sessionID: string;
  state: SessionState;
  resolvedInfo: SessionAgentInfo;
}): Promise<ContinuationResult> => {
  const { ctx, config, sessionID, state, resolvedInfo } = args;

  try {
    const todoResponse = await ctx.client.session.todo({
      path: { id: sessionID },
    });
    const todos = unwrapSdkResponse(todoResponse, [] as Todo[]);
    const incompleteCount = getIncompleteTodoCount(todos);
    if (incompleteCount === 0) {
      return { status: "skipped-no-todos" };
    }

    state.inFlight = true;
    await ctx.client.session.promptAsync({
      path: { id: sessionID },
      query: { directory: ctx.directory },
      body: {
        agent: resolvedInfo.agent,
        model: resolvedInfo.model,
        parts: [
          {
            type: "text",
            text: `${config.prompt}\n[${INTERNAL_INITIATOR_MARKER}]`,
            metadata: {
              [INTERNAL_INITIATOR_MARKER]: true,
            },
          },
        ],
      },
    });

    state.lastInjectedAt = config.now();
    state.consecutiveFailures = 0;
    return { status: "injected" };
  } catch (_error) {
    state.lastInjectedAt = config.now();
    state.consecutiveFailures += 1;
    await ctx.client.tui
      .showToast({
        body: {
          variant: "warning",
          message: `Todo enforcer continuation failed for ${sessionID}; backing off.`,
        },
      })
      .catch(swallowError);
    return { status: "failed" };
  } finally {
    state.inFlight = false;
  }
};
