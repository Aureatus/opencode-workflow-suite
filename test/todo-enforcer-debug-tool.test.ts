import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ToolContext } from "@opencode-ai/plugin";

import {
  resolveDebugPingFilePath,
  todoEnforcerDebugPingTool,
} from "../src/todo-enforcer/debug-tool";

describe("todo enforcer debug ping tool", () => {
  test("writes debug ping in session directory", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "todo-enforcer-tool-")
    );
    const ignoreMetadata = (): void => undefined;
    const allowAsk = async (): Promise<void> => Promise.resolve();

    const context = {
      sessionID: "session-debug",
      messageID: "message-debug",
      agent: "sisyphus",
      directory,
      worktree: directory,
      abort: new AbortController().signal,
      metadata: ignoreMetadata,
      ask: allowAsk,
    } as ToolContext;

    const output = await todoEnforcerDebugPingTool.execute(
      { marker: "marker-1" },
      context
    );
    const parsed = JSON.parse(output) as {
      ok: boolean;
      marker: string;
      ping_path: string;
    };

    expect(parsed.ok).toBe(true);
    expect(parsed.marker).toBe("marker-1");

    const pingPath = resolveDebugPingFilePath(directory);
    expect(parsed.ping_path).toBe(pingPath);

    const content = await readFile(pingPath, "utf8");
    expect(content).toContain("debug_ping");
    expect(content).toContain("marker-1");
  });
});
