import type { WorkflowNotifierConfig } from "./types";

export interface WorkflowNotifierOptions {
  enabled?: boolean;
  settleMs?: number;
  maxWaitMs?: number;
  pollMs?: number;
  cooldownMs?: number;
  showToastFallback?: boolean;
  events?: {
    terminalReady?: boolean;
    paused?: boolean;
    enforcerFailure?: boolean;
    error?: boolean;
    permission?: boolean;
    question?: boolean;
  };
  command?: {
    enabled?: boolean;
    path?: string;
    args?: string[];
  };
  now?: () => number;
}

const defaultNow = (): number => Date.now();

const envValue = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
};

export const createWorkflowNotifierConfig = (
  options?: WorkflowNotifierOptions
): WorkflowNotifierConfig => {
  const commandPath =
    options?.command?.path ??
    envValue("OPENCODE_WORKFLOW_NOTIFY_COMMAND") ??
    "";

  return {
    enabled: options?.enabled ?? true,
    settleMs: options?.settleMs ?? 3000,
    maxWaitMs: options?.maxWaitMs ?? 10_000,
    pollMs: options?.pollMs ?? 400,
    cooldownMs: options?.cooldownMs ?? 1500,
    showToastFallback: options?.showToastFallback ?? true,
    events: {
      terminalReady: options?.events?.terminalReady ?? true,
      paused: options?.events?.paused ?? true,
      enforcerFailure: options?.events?.enforcerFailure ?? true,
      error: options?.events?.error ?? true,
      permission: options?.events?.permission ?? true,
      question: options?.events?.question ?? true,
    },
    command: {
      enabled: options?.command?.enabled ?? commandPath.length > 0,
      path: commandPath,
      args: options?.command?.args ?? ["{event}", "{message}"],
    },
    now: options?.now ?? defaultNow,
  };
};
