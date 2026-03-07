export interface StopStateStore {
  isStopped: (sessionID: string) => boolean;
  setStopped: (sessionID: string, value: boolean) => void;
  clear: (sessionID: string) => void;
}

export const createStopStateStore = (): StopStateStore => {
  const stoppedSessions = new Set<string>();

  return {
    isStopped: (sessionID: string): boolean => stoppedSessions.has(sessionID),
    setStopped: (sessionID: string, value: boolean): void => {
      if (value) {
        stoppedSessions.add(sessionID);
        return;
      }
      stoppedSessions.delete(sessionID);
    },
    clear: (sessionID: string): void => {
      stoppedSessions.delete(sessionID);
    },
  };
};
