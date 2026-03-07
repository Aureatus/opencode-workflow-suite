import type { PluginInput } from "@opencode-ai/plugin";

import type { SessionState, TodoEnforcerConfig } from "./types";

export const cancelCountdown = (state: SessionState): void => {
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

const swallowError = (_error: unknown): undefined => {
  return undefined;
};

export const startCountdown = (args: {
  ctx: PluginInput;
  config: TodoEnforcerConfig;
  state: SessionState;
  sessionID: string;
  incompleteCount: number;
  onElapsed: () => Promise<void>;
}): void => {
  const { ctx, config, state, sessionID, incompleteCount, onElapsed } = args;

  cancelCountdown(state);
  state.countdownStartedAt = config.now();

  ctx.client.tui
    .showToast({
      body: {
        variant: "warning",
        message: `Todo enforcer continuing in ${(config.countdownMs / 1000).toFixed(1)}s (${incompleteCount} incomplete).`,
      },
    })
    .catch(swallowError);

  state.warningTimer = setTimeout(
    () => {
      ctx.client.tui
        .showToast({
          body: {
            variant: "warning",
            message: `Todo enforcer continuing now for session ${sessionID}.`,
          },
        })
        .catch(swallowError);
    },
    Math.max(0, config.countdownMs - 1000)
  );

  state.countdownTimer = setTimeout(() => {
    state.countdownTimer = undefined;
    state.warningTimer = undefined;
    state.countdownStartedAt = undefined;
    onElapsed().catch(swallowError);
  }, config.countdownMs);
};
