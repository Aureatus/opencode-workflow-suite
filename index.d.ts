import type { Plugin } from "@opencode-ai/plugin";

export interface TodoEnforcerOptions {
  enabled?: boolean;
  prompt?: string;
  stopCommand?: string;
  skipAgents?: string[];
  countdownMs?: number;
  countdownGraceMs?: number;
  continuationCooldownMs?: number;
  abortWindowMs?: number;
  failureResetWindowMs?: number;
  maxConsecutiveFailures?: number;
  sessionTtlMs?: number;
  sessionPruneIntervalMs?: number;
  debug?: boolean;
  guards?: {
    abortWindow?: boolean;
    backgroundTasks?: boolean;
    skippedAgents?: boolean;
    stopState?: boolean;
  };
  hasRunningBackgroundTasks?: (sessionID: string) => boolean;
  now?: () => number;
}

export interface WorkflowNotifierOptions {
  enabled?: boolean;
  settleMs?: number;
  maxWaitMs?: number;
  pollMs?: number;
  cooldownMs?: number;
  showToastFallback?: boolean;
  suppressWhenFocused?: boolean;
  focusTitleHints?: string[];
  quietHours?: {
    enabled?: boolean;
    start?: string;
    end?: string;
  };
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
  focusCommand?: {
    enabled?: boolean;
    path?: string;
    args?: string[];
  };
  now?: () => number;
}

export interface TodoWorkflowOptions {
  todoEnforcer?: TodoEnforcerOptions;
  notifier?: WorkflowNotifierOptions;
}

export type WorkflowSuiteOptions = TodoWorkflowOptions;

export declare const WorkflowSuitePlugin: Plugin;
export declare const createWorkflowSuitePlugin: (
  options?: TodoWorkflowOptions
) => Plugin;

export default WorkflowSuitePlugin;
