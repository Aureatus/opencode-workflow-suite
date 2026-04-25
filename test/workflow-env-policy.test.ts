import { afterEach, describe, expect, test } from "bun:test";

import { createWorkflowNotifierConfig } from "../src/notifier/config";
import { createTodoEnforcerConfig } from "../src/todo-enforcer/config";
import { STOP_CONTINUATION_COMMAND } from "../src/todo-enforcer/constants";

const ENVS = [
  "OPENCODE_WORKFLOW_SUITE_STOP_COMMAND",
  "OPENCODE_WORKFLOW_SUITE_NOTIFY_COMMAND",
  "OPENCODE_WORKFLOW_SUITE_NOTIFIER_SETTLE_MS",
  "OPENCODE_WORKFLOW_SUITE_QUIET_HOURS_ENABLED",
] as const;

afterEach(() => {
  for (const key of ENVS) {
    delete process.env[key];
  }
});

describe("workflow runtime env policy", () => {
  test("todo enforcer ignores runtime env configuration", () => {
    process.env.OPENCODE_WORKFLOW_SUITE_STOP_COMMAND = "CUSTOM_STOP";

    const config = createTodoEnforcerConfig();
    expect(config.stopCommand).toBe(STOP_CONTINUATION_COMMAND);
  });

  test("notifier ignores runtime env configuration", () => {
    process.env.OPENCODE_WORKFLOW_SUITE_NOTIFY_COMMAND = "notify-cmd";
    process.env.OPENCODE_WORKFLOW_SUITE_NOTIFIER_SETTLE_MS = "1";
    process.env.OPENCODE_WORKFLOW_SUITE_QUIET_HOURS_ENABLED = "true";

    const config = createWorkflowNotifierConfig();
    expect(config.command.path).toBe("");
    expect(config.settleMs).toBe(3000);
    expect(config.quietHours.enabled).toBe(false);
  });
});
