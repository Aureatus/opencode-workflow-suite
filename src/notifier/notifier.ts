import { spawn } from "node:child_process";
import { basename } from "node:path";

import type { PluginInput } from "@opencode-ai/plugin";
import type { Event } from "@opencode-ai/sdk";

import { isAbortLikeError } from "../todo-enforcer/abort-detection";
import type { TodoEnforcerLifecycleEvent } from "../todo-enforcer/lifecycle";
import { createTodoEnforcerTelemetry } from "../todo-enforcer/telemetry";
import {
  extractSessionIDFromEvent,
  isPermissionEvent,
} from "../workflow-core/event-utils";
import type {
  WorkflowNotificationEvent,
  WorkflowNotifierConfig,
} from "./types";

interface WorkflowNotifierArgs {
  ctx: PluginInput;
  config: WorkflowNotifierConfig;
  spawnProcess?: typeof spawn;
}

type IdleOutcome =
  | "unknown"
  | "continued"
  | "terminal-ready"
  | "paused"
  | "enforcer-failure";

interface IdleTracker {
  idleVersion: number;
  idleStartedAt?: number;
  outcome: IdleOutcome;
  timer?: ReturnType<typeof setTimeout>;
}

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

const CLOCK_PATTERN = /^(\d{2}):(\d{2})$/;

const NO_OP = (_error: unknown): undefined => {
  return undefined;
};

const parseClockMinutes = (value: string): number | undefined => {
  const match = CLOCK_PATTERN.exec(value.trim());
  if (!match) {
    return undefined;
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (
    !(Number.isInteger(hours) && Number.isInteger(minutes)) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return undefined;
  }

  return hours * 60 + minutes;
};

const runCommandWithOutput = async (
  spawnProcess: typeof spawn,
  command: string,
  args: string[]
): Promise<CommandResult> => {
  return await new Promise<CommandResult>((resolve) => {
    const child = spawnProcess(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", () => {
      resolve({ code: 1, stderr: "spawn error", stdout: "" });
    });
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
};

const clearTimer = (tracker: IdleTracker): void => {
  if (tracker.timer) {
    clearTimeout(tracker.timer);
    tracker.timer = undefined;
  }
};

const shouldNotifyForEvent = (
  config: WorkflowNotifierConfig,
  eventType: WorkflowNotificationEvent
): boolean => {
  switch (eventType) {
    case "terminal_ready":
      return config.events.terminalReady;
    case "session_paused":
      return config.events.paused;
    case "enforcer_failure":
      return config.events.enforcerFailure;
    case "error":
      return config.events.error;
    case "permission":
      return config.events.permission;
    case "question":
      return config.events.question;
    default:
      return true;
  }
};

const getNotificationMessage = (
  eventType: WorkflowNotificationEvent,
  sessionTitle: string,
  reason?: string
): string => {
  switch (eventType) {
    case "terminal_ready":
      return `Session ready: ${sessionTitle}`;
    case "session_paused":
      return `Continuation paused for ${sessionTitle}`;
    case "enforcer_failure":
      return `Continuation failed repeatedly for ${sessionTitle}`;
    case "error":
      return `Session error in ${sessionTitle}`;
    case "permission":
      return `Permission required in ${sessionTitle}`;
    case "question":
      return `Question requires input in ${sessionTitle}`;
    default:
      return reason ?? `Event ${eventType} in ${sessionTitle}`;
  }
};

const isWithinQuietHours = (
  config: WorkflowNotifierConfig,
  nowEpochMs: number
): boolean => {
  if (!config.quietHours.enabled) {
    return false;
  }

  const start = parseClockMinutes(config.quietHours.start);
  const end = parseClockMinutes(config.quietHours.end);
  if (start === undefined || end === undefined || start === end) {
    return false;
  }

  const now = new Date(nowEpochMs);
  const current = now.getHours() * 60 + now.getMinutes();
  if (start < end) {
    return current >= start && current < end;
  }

  return current >= start || current < end;
};

export const createWorkflowNotifier = ({
  ctx,
  config,
  spawnProcess,
}: WorkflowNotifierArgs) => {
  const spawnFn = spawnProcess ?? spawn;
  const telemetry = createTodoEnforcerTelemetry();
  const trackers = new Map<string, IdleTracker>();
  const projectName = basename(ctx.directory || ctx.worktree || "project");
  const lastNotificationAt = new Map<string, number>();

  const logNotifierEvent = (args: {
    eventType: WorkflowNotificationEvent;
    kind: "notifier_sent" | "notifier_suppressed";
    reason?: string;
    sessionID?: string;
  }): void => {
    telemetry.log({
      kind: args.kind,
      metadata: {
        event_type: args.eventType,
      },
      reason: args.reason,
      sessionID: args.sessionID,
    });
  };

  const getTracker = (sessionID: string): IdleTracker => {
    const existing = trackers.get(sessionID);
    if (existing) {
      return existing;
    }

    const created: IdleTracker = {
      idleVersion: 0,
      outcome: "unknown",
    };
    trackers.set(sessionID, created);
    return created;
  };

  const clearSession = (sessionID: string): void => {
    const tracker = trackers.get(sessionID);
    if (tracker) {
      clearTimer(tracker);
    }
    trackers.delete(sessionID);
  };

  const getSessionTitle = async (sessionID: string): Promise<string> => {
    try {
      const response = await ctx.client.session.get({
        path: { id: sessionID },
        query: { directory: ctx.directory },
      });
      const title = response.data?.title?.trim();
      if (title) {
        return title;
      }
    } catch {
      return sessionID;
    }
    return sessionID;
  };

  const isTerminalFocused = async (): Promise<boolean> => {
    if (!config.suppressWhenFocused) {
      return false;
    }

    if (config.focusCommand.enabled && config.focusCommand.path.length > 0) {
      const result = await runCommandWithOutput(
        spawnFn,
        config.focusCommand.path,
        config.focusCommand.args
      );
      return result.code === 0;
    }

    if (process.platform !== "linux") {
      return false;
    }

    const result = await runCommandWithOutput(spawnFn, "xdotool", [
      "getactivewindow",
      "getwindowname",
    ]);
    if (result.code !== 0 || result.stdout.length === 0) {
      return false;
    }

    const title = result.stdout.toLowerCase();
    return config.focusTitleHints.some((hint) =>
      title.includes(hint.toLowerCase())
    );
  };

  const executeNotificationCommand = async (args: {
    eventType: WorkflowNotificationEvent;
    message: string;
    reason?: string;
    sessionID?: string;
    sessionTitle: string;
  }): Promise<void> => {
    if (!config.command.enabled || config.command.path.length === 0) {
      return;
    }

    const key = `${args.eventType}:${args.sessionID ?? "global"}`;
    const now = config.now();
    const previous = lastNotificationAt.get(key);
    if (previous !== undefined && now - previous < config.cooldownMs) {
      return;
    }
    lastNotificationAt.set(key, now);

    const replacements: Record<string, string> = {
      "{event}": args.eventType,
      "{message}": args.message,
      "{project}": projectName,
      "{reason}": args.reason ?? "",
      "{sessionID}": args.sessionID ?? "",
      "{sessionTitle}": args.sessionTitle,
    };

    const resolvedArgs = config.command.args.map((arg) => {
      let next = arg;
      for (const [token, replacement] of Object.entries(replacements)) {
        next = next.split(token).join(replacement);
      }
      return next;
    });

    await new Promise<void>((resolve) => {
      const child = spawnFn(config.command.path, resolvedArgs, {
        detached: true,
        stdio: "ignore",
      });

      child.on("error", () => resolve());
      child.unref();
      resolve();
    });
  };

  const showFallbackToast = async (args: {
    eventType: WorkflowNotificationEvent;
    message: string;
  }): Promise<void> => {
    if (!config.showToastFallback) {
      return;
    }

    const variant =
      args.eventType === "error" || args.eventType === "enforcer_failure"
        ? "error"
        : "info";

    await ctx.client.tui
      .showToast({
        body: {
          variant,
          message: args.message,
        },
      })
      .catch(NO_OP);
  };

  const notify = async (args: {
    eventType: WorkflowNotificationEvent;
    reason?: string;
    sessionID?: string;
  }): Promise<void> => {
    if (!(config.enabled && shouldNotifyForEvent(config, args.eventType))) {
      return;
    }

    const now = config.now();
    if (isWithinQuietHours(config, now)) {
      logNotifierEvent({
        eventType: args.eventType,
        kind: "notifier_suppressed",
        reason: "quiet-hours",
        sessionID: args.sessionID,
      });
      return;
    }

    if (await isTerminalFocused()) {
      logNotifierEvent({
        eventType: args.eventType,
        kind: "notifier_suppressed",
        reason: "focused",
        sessionID: args.sessionID,
      });
      return;
    }

    const sessionTitle = args.sessionID
      ? await getSessionTitle(args.sessionID)
      : "OpenCode session";
    const message = getNotificationMessage(
      args.eventType,
      sessionTitle,
      args.reason
    );

    await executeNotificationCommand({
      eventType: args.eventType,
      message,
      reason: args.reason,
      sessionID: args.sessionID,
      sessionTitle,
    });
    await showFallbackToast({ eventType: args.eventType, message });
    logNotifierEvent({
      eventType: args.eventType,
      kind: "notifier_sent",
      reason: args.reason,
      sessionID: args.sessionID,
    });
  };

  const evaluateIdleOutcome = async (
    sessionID: string,
    idleVersion: number
  ): Promise<void> => {
    const tracker = trackers.get(sessionID);
    if (
      !tracker ||
      tracker.idleVersion !== idleVersion ||
      !tracker.idleStartedAt
    ) {
      return;
    }

    const elapsed = config.now() - tracker.idleStartedAt;
    if (tracker.outcome === "unknown" && elapsed < config.maxWaitMs) {
      tracker.timer = setTimeout(() => {
        evaluateIdleOutcome(sessionID, idleVersion).catch(NO_OP);
      }, config.pollMs);
      return;
    }

    if (tracker.outcome === "terminal-ready") {
      await notify({ eventType: "terminal_ready", sessionID });
      return;
    }

    if (tracker.outcome === "paused") {
      await notify({
        eventType: "session_paused",
        sessionID,
        reason: "stop-state",
      });
      return;
    }

    if (tracker.outcome === "enforcer-failure") {
      await notify({
        eventType: "enforcer_failure",
        reason: "max-failures",
        sessionID,
      });
      return;
    }

    if (tracker.outcome === "unknown") {
      await notify({
        eventType: "terminal_ready",
        reason: "settle-timeout",
        sessionID,
      });
    }
  };

  const scheduleIdleEvaluation = async (sessionID: string): Promise<void> => {
    const tracker = getTracker(sessionID);
    tracker.idleVersion += 1;
    tracker.idleStartedAt = config.now();
    tracker.outcome = "unknown";
    clearTimer(tracker);

    const idleVersion = tracker.idleVersion;
    if (config.settleMs <= 0) {
      await evaluateIdleOutcome(sessionID, idleVersion);
      return;
    }

    tracker.timer = setTimeout(() => {
      evaluateIdleOutcome(sessionID, idleVersion).catch(NO_OP);
    }, config.settleMs);
  };

  const markBusy = (sessionID: string): void => {
    const tracker = getTracker(sessionID);
    tracker.outcome = "continued";
    clearTimer(tracker);
  };

  const onEnforcerLifecycle = (event: TodoEnforcerLifecycleEvent): void => {
    const tracker = getTracker(event.sessionID);

    if (event.kind === "session_deleted") {
      clearSession(event.sessionID);
      return;
    }

    if (event.kind === "idle_seen") {
      if (
        config.enabled &&
        shouldNotifyForEvent(config, "terminal_ready") &&
        isWithinQuietHours(config, config.now())
      ) {
        logNotifierEvent({
          eventType: "terminal_ready",
          kind: "notifier_suppressed",
          reason: "quiet-hours",
          sessionID: event.sessionID,
        });
      }
      return;
    }

    if (event.kind === "injected" || event.kind === "countdown_cancelled") {
      tracker.outcome = "continued";
      return;
    }

    if (event.kind !== "idle_skipped") {
      return;
    }

    if (event.reason === "todo-complete") {
      tracker.outcome = "terminal-ready";
      return;
    }

    if (event.reason === "stop-state") {
      tracker.outcome = "paused";
      return;
    }

    if (event.reason === "max-failures") {
      tracker.outcome = "enforcer-failure";
      return;
    }

    tracker.outcome = "continued";
  };

  const onEvent = async (input: { event: Event }): Promise<void> => {
    if (!config.enabled) {
      return;
    }

    const { event } = input;
    const sessionID = extractSessionIDFromEvent(event);

    switch (event.type) {
      case "session.deleted": {
        if (sessionID) {
          clearSession(sessionID);
        }
        return;
      }
      case "session.idle": {
        if (sessionID) {
          await scheduleIdleEvaluation(sessionID);
        }
        return;
      }
      case "session.status":
      case "message.updated":
      case "message.part.updated": {
        if (sessionID) {
          markBusy(sessionID);
        }
        return;
      }
      case "session.error": {
        if (!isAbortLikeError(event.properties.error)) {
          await notify({ eventType: "error", sessionID });
        }
        return;
      }
      default: {
        if (isPermissionEvent(event)) {
          await notify({ eventType: "permission", sessionID });
        }
      }
    }
  };

  const onPermissionAsk = async (input: {
    sessionID?: string;
  }): Promise<void> => {
    await notify({ eventType: "permission", sessionID: input.sessionID });
  };

  const onToolExecuteBefore = async (input: {
    sessionID: string;
    tool: string;
  }): Promise<void> => {
    if (input.tool === "question") {
      await notify({ eventType: "question", sessionID: input.sessionID });
    }
  };

  const dispose = (): void => {
    for (const tracker of trackers.values()) {
      clearTimer(tracker);
    }
    trackers.clear();
  };

  return {
    dispose,
    onEnforcerLifecycle,
    onEvent,
    onPermissionAsk,
    onToolExecuteBefore,
  };
};
