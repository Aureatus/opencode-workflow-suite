export type WorkflowNotificationEvent =
  | "terminal_ready"
  | "session_paused"
  | "enforcer_failure"
  | "error"
  | "permission"
  | "question";

export interface WorkflowNotifierConfig {
  enabled: boolean;
  settleMs: number;
  maxWaitMs: number;
  pollMs: number;
  cooldownMs: number;
  showToastFallback: boolean;
  events: {
    terminalReady: boolean;
    paused: boolean;
    enforcerFailure: boolean;
    error: boolean;
    permission: boolean;
    question: boolean;
  };
  command: {
    enabled: boolean;
    path: string;
    args: string[];
  };
  now: () => number;
}
