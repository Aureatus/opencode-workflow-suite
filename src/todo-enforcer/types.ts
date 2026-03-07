import type { Event, Part, Todo } from "@opencode-ai/sdk";

export interface TodoEnforcerConfig {
  enabled: boolean;
  prompt: string;
  stopCommand: string;
  skipAgents: string[];
  countdownMs: number;
  countdownGraceMs: number;
  continuationCooldownMs: number;
  abortWindowMs: number;
  failureResetWindowMs: number;
  maxConsecutiveFailures: number;
  sessionTtlMs: number;
  sessionPruneIntervalMs: number;
  debug: boolean;
  guards: {
    abortWindow: boolean;
    backgroundTasks: boolean;
    skippedAgents: boolean;
    stopState: boolean;
  };
  hasRunningBackgroundTasks?: (sessionID: string) => boolean;
  now: () => number;
}

export interface SessionAgentInfo {
  agent?: string;
  model?: {
    providerID: string;
    modelID: string;
  };
}

export interface SessionState {
  inFlight: boolean;
  isRecovering: boolean;
  lastInjectedAt?: number;
  consecutiveFailures: number;
  abortDetectedAt?: number;
  countdownStartedAt?: number;
  userActivityAt?: number;
  countdownTimer?: ReturnType<typeof setTimeout>;
  warningTimer?: ReturnType<typeof setTimeout>;
}

export interface EventContext {
  sessionID: string;
  event: Event;
}

export interface IdleSnapshot {
  todos: Todo[];
  incompleteCount: number;
  resolvedInfo: SessionAgentInfo;
}

export interface PromptMessage {
  info?: {
    role?: string;
    error?: {
      name?: string;
      message?: string;
      type?: string;
    };
    agent?: string;
    providerID?: string;
    modelID?: string;
    model?: {
      providerID: string;
      modelID: string;
    };
  };
  parts?: Part[];
}

export interface TodoEnforcerDependencies {
  config: TodoEnforcerConfig;
  stopState: {
    isStopped: (sessionID: string) => boolean;
    setStopped: (sessionID: string, value: boolean) => void;
    clear: (sessionID: string) => void;
  };
}
