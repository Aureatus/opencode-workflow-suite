import { appendFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

interface TelemetryEventInput {
  kind: string;
  sessionID?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

interface TelemetryEventRecord {
  event: "workflow_suite";
  kind: string;
  session_id?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  context?: string;
  timestamp: number;
}

const defaultTelemetryPath = (): string => {
  return path.join(
    os.homedir(),
    ".local",
    "share",
    "opencode",
    "plugins",
    "opencode-workflow-suite",
    "telemetry.jsonl"
  );
};

const swallowError = (_error: unknown): undefined => {
  return undefined;
};

const resolveTelemetryPath = (): string => {
  const customPath = process.env.OPENCODE_WORKFLOW_SUITE_TELEMETRY_PATH?.trim();
  if (customPath) {
    return customPath;
  }
  return defaultTelemetryPath();
};

export const createTodoEnforcerTelemetry = (): {
  log: (entry: TelemetryEventInput) => void;
} => {
  const disabled = process.env.OPENCODE_WORKFLOW_SUITE_TELEMETRY === "false";
  const telemetryPath = resolveTelemetryPath();
  const context = process.env.OPENCODE_WORKFLOW_SUITE_TELEMETRY_CONTEXT?.trim();

  let initialized = false;

  const log = (entry: TelemetryEventInput): void => {
    if (disabled) {
      return;
    }

    const payload: TelemetryEventRecord = {
      event: "workflow_suite",
      kind: entry.kind,
      session_id: entry.sessionID,
      reason: entry.reason,
      metadata: entry.metadata,
      context,
      timestamp: Date.now(),
    };

    try {
      if (!initialized) {
        mkdirSync(path.dirname(telemetryPath), {
          recursive: true,
        });
        initialized = true;
      }

      appendFileSync(telemetryPath, `${JSON.stringify(payload)}\n`, "utf8");
    } catch (error) {
      swallowError(error);
    }
  };

  return { log };
};
