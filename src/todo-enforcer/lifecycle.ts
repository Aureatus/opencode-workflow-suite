export interface TodoEnforcerLifecycleEvent {
  kind: string;
  sessionID: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}
