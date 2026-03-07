import { spawn } from "node:child_process";
import { basename } from "node:path";

import type { PluginInput } from "@opencode-ai/plugin";
import type { Event } from "@opencode-ai/sdk";

import { isAbortLikeError } from "../todo-enforcer/abort-detection";
import type { TodoEnforcerLifecycleEvent } from "../todo-enforcer/lifecycle";
import type {
  WorkflowNotificationEvent,
  WorkflowNotifierConfig,
} from "./types";

interface WorkflowNotifierArgs {
  ctx: PluginInput;
  config: WorkflowNotifierConfig;
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

const NO_OP = (_error: unknown): undefined => {
  return undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const extractSessionIDFromEvent = (event: Event): string | undefined => {
  if (!isRecord(event.properties)) {
    return undefined;
  }
  const properties = event.properties as Record<string, unknown>;

  const fromProperties = properties.sessionID;
  if (typeof fromProperties === "string") {
    return fromProperties;
  }

  const info = properties.info;
  if (!isRecord(info)) {
    return undefined;
  }

  const fromInfo = info.sessionID ?? info.id;
  return typeof fromInfo === "string" ? fromInfo : undefined;
};

const clearTimer = (tracker: IdleTracker): void => {
  if (tracker.timer) {
    clearTimeout(tracker.timer);
    tracker.timer = undefined;
  }
};

export const createWorkflowNotifier = ({
  ctx,
  config,
}: WorkflowNotifierArgs) => {
  const trackers = new Map<string, IdleTracker>();
  const projectName = basename(ctx.directory || ctx.worktree || "project");
  const lastNotificationAt = new Map<string, number>();

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

  const canNotify = (eventType: WorkflowNotificationEvent): boolean => {
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

  const resolveMessage = (
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

  const executeCommand = async (args: {
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
    const previous = lastNotificationAt.get(key) ?? 0;
    if (now - previous < config.cooldownMs) {
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
      const child = spawn(config.command.path, resolvedArgs, {
        detached: true,
        stdio: "ignore",
      });

      child.on("error", () => resolve());
      child.unref();
      resolve();
    });
  };

  const sendFallbackToast = async (args: {
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
    if (!config.enabled) {
      return;
    }

    if (!canNotify(args.eventType)) {
      return;
    }

    const sessionTitle = args.sessionID
      ? await getSessionTitle(args.sessionID)
      : "OpenCode session";
    const message = resolveMessage(args.eventType, sessionTitle, args.reason);

    await executeCommand({
      eventType: args.eventType,
      message,
      reason: args.reason,
      sessionID: args.sessionID,
      sessionTitle,
    });
    await sendFallbackToast({ eventType: args.eventType, message });
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

  const scheduleIdleEvaluation = (sessionID: string): void => {
    const tracker = getTracker(sessionID);
    tracker.idleVersion += 1;
    tracker.idleStartedAt = config.now();
    tracker.outcome = "unknown";
    clearTimer(tracker);

    const idleVersion = tracker.idleVersion;
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

  const handleSessionDeleted = (sessionID?: string): void => {
    if (!sessionID) {
      return;
    }
    clearSession(sessionID);
  };

  const handleSessionIdle = (sessionID?: string): void => {
    if (!sessionID) {
      return;
    }
    scheduleIdleEvaluation(sessionID);
  };

  const handleBusyEvent = (sessionID?: string): void => {
    if (!sessionID) {
      return;
    }
    markBusy(sessionID);
  };

  const isPermissionEvent = (event: Event): boolean => {
    return (
      event.type === "permission.updated" ||
      (event as { type?: string }).type === "permission.asked"
    );
  };

  const onEvent = async (input: { event: Event }): Promise<void> => {
    if (!config.enabled) {
      return;
    }

    const { event } = input;
    const sessionID = extractSessionIDFromEvent(event);

    switch (event.type) {
      case "session.deleted": {
        handleSessionDeleted(sessionID);
        return;
      }
      case "session.idle": {
        handleSessionIdle(sessionID);
        return;
      }
      case "session.status":
      case "message.updated":
      case "message.part.updated": {
        handleBusyEvent(sessionID);
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
