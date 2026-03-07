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
  suppressWhenFocused: boolean;
  focusTitleHints: string[];
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
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
  focusCommand: {
    enabled: boolean;
    path: string;
    args: string[];
  };
  now: () => number;
}
