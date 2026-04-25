import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { PluginInput } from "@opencode-ai/plugin";
import type { Event } from "@opencode-ai/sdk";

import { createWorkflowSuitePlugin } from "../src";
import { loadWorkflowSuiteOptionsFromFile } from "../src/workflow-core/file-config";

const temporaryDirectories: string[] = [];
const MODULE_ENV = "OPENCODE_WORKFLOW_SUITE_ENABLE_REPO_LOCAL";

const createHarness = (directory = "/tmp/workflow-suite") => {
  const promptCalls: unknown[] = [];
  const todoCalls: unknown[] = [];
  const messageCalls: unknown[] = [];
  const toastCalls: unknown[] = [];

  const ctx = {
    directory,
    worktree: directory,
    client: {
      session: {
        todo: () => {
          todoCalls.push(true);
          return Promise.resolve({ data: [] });
        },
        messages: () => {
          messageCalls.push(true);
          return Promise.resolve({ data: [] });
        },
        promptAsync: (payload: unknown) => {
          promptCalls.push(payload);
          return Promise.resolve({ data: true });
        },
        get: () =>
          Promise.resolve({
            data: {
              id: "session-1",
              title: "Workflow test session",
            },
          }),
      },
      tui: {
        showToast: (payload: unknown) => {
          toastCalls.push(payload);
          return Promise.resolve({ data: true });
        },
      },
    },
  } as unknown as PluginInput;

  return {
    ctx,
    messageCalls,
    promptCalls,
    toastCalls,
    todoCalls,
  };
};

afterEach(() => {
  delete process.env[MODULE_ENV];
  return Promise.all(
    temporaryDirectories.splice(0).map((directory) => {
      return rm(directory, { recursive: true, force: true });
    })
  );
});

const createConfigDirectory = async (
  configContents: string
): Promise<string> => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "workflow-suite-config-")
  );
  temporaryDirectories.push(directory);
  await writeFile(
    path.join(directory, "opencode-workflow-suite.config.jsonc"),
    configContents,
    "utf8"
  );
  return directory;
};

describe("workflow suite module configuration", () => {
  test("registers repo tool by default", async () => {
    const harness = createHarness();
    const hooks = await createWorkflowSuitePlugin()(harness.ctx);
    expect(Boolean(hooks.tool?.repo_ensure_local)).toBe(true);
  });

  test("ignores module env toggles for runtime behavior", async () => {
    process.env[MODULE_ENV] = "false";
    const harness = createHarness();
    const hooks = await createWorkflowSuitePlugin()(harness.ctx);
    expect(Boolean(hooks.tool?.repo_ensure_local)).toBe(true);
  });

  test("disables repo tool through plugin options", async () => {
    const harness = createHarness();
    const hooks = await createWorkflowSuitePlugin({
      modules: {
        repoLocal: false,
      },
    })(harness.ctx);
    expect(Boolean(hooks.tool?.repo_ensure_local)).toBe(false);
  });

  test("disables repo tool through JSONC config file", async () => {
    const directory = await createConfigDirectory(`
      {
        // module toggles
        "modules": {
          "repoLocal": false
        }
      }
    `);
    const harness = createHarness(directory);
    const hooks = await createWorkflowSuitePlugin()(harness.ctx);
    expect(Boolean(hooks.tool?.repo_ensure_local)).toBe(false);
  });

  test("plugin options override JSONC module toggles", async () => {
    const directory = await createConfigDirectory(`
      {
        "modules": {
          "repoLocal": false
        }
      }
    `);
    const harness = createHarness(directory);
    const hooks = await createWorkflowSuitePlugin({
      modules: {
        repoLocal: true,
      },
    })(harness.ctx);
    expect(Boolean(hooks.tool?.repo_ensure_local)).toBe(true);
  });

  test("can disable notifier module entirely", async () => {
    const harness = createHarness();
    const hooks = await createWorkflowSuitePlugin({
      modules: {
        notifier: false,
      },
    })(harness.ctx);

    await hooks["permission.ask"]?.(
      { sessionID: "session-1" } as never,
      undefined as never
    );
    expect(harness.toastCalls).toHaveLength(0);
  });

  test("can disable notifier module through JSONC config", async () => {
    const directory = await createConfigDirectory(`
      {
        "modules": {
          "notifier": false
        }
      }
    `);
    const harness = createHarness(directory);
    const hooks = await createWorkflowSuitePlugin()(harness.ctx);

    await hooks["permission.ask"]?.(
      { sessionID: "session-1" } as never,
      undefined as never
    );
    expect(harness.toastCalls).toHaveLength(0);
  });

  test("loads notifier command args from JSONC config", async () => {
    const directory = await createConfigDirectory(`
      {
        "notifier": {
          "command": {
            "enabled": true,
            "path": "notify-cmd",
            "args": ["/tmp/ready.ogg"]
          }
        }
      }
    `);
    const harness = createHarness(directory);
    const options = loadWorkflowSuiteOptionsFromFile(harness.ctx);
    expect(options?.notifier?.command?.args).toEqual(["/tmp/ready.ogg"]);
  });

  test("can disable todo enforcer module entirely", async () => {
    const harness = createHarness();
    const hooks = await createWorkflowSuitePlugin({
      modules: {
        todoEnforcer: false,
        notifier: false,
      },
    })(harness.ctx);

    await hooks.event?.({
      event: {
        type: "session.idle",
        properties: { sessionID: "session-1" },
      } as Event,
    });

    expect(harness.todoCalls).toHaveLength(0);
    expect(harness.messageCalls).toHaveLength(0);
    expect(harness.promptCalls).toHaveLength(0);
  });
});
