import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { tool } from "@opencode-ai/plugin";

import { createTodoEnforcerTelemetry } from "./telemetry";

export const DEBUG_PING_FILENAME = ".opencode-workflow-suite-debug-pings.jsonl";

export const resolveDebugPingFilePath = (directory: string): string => {
  return path.join(directory, DEBUG_PING_FILENAME);
};

const telemetry = createTodoEnforcerTelemetry();

export const todoEnforcerDebugPingTool = tool({
  description:
    "Debug helper that proves opencode-workflow-suite plugin/tool execution at runtime.",
  args: {
    marker: tool.schema
      .string()
      .optional()
      .describe("Optional marker string echoed into debug ping records."),
  },
  execute: async (args, context) => {
    const marker = args.marker?.trim() || "default";
    const pingPath = resolveDebugPingFilePath(context.directory);
    const payload = {
      event: "debug_ping",
      marker,
      sessionID: context.sessionID,
      messageID: context.messageID,
      agent: context.agent,
      directory: context.directory,
      worktree: context.worktree,
      timestamp: Date.now(),
    };

    await mkdir(path.dirname(pingPath), { recursive: true });
    await appendFile(pingPath, `${JSON.stringify(payload)}\n`, "utf8");

    telemetry.log({
      kind: "debug_ping_tool",
      sessionID: context.sessionID,
      metadata: {
        marker,
        ping_path: pingPath,
      },
    });

    return JSON.stringify(
      {
        ok: true,
        marker,
        ping_path: pingPath,
      },
      null,
      2
    );
  },
});
