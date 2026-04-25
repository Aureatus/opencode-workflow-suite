import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { PluginInput } from "@opencode-ai/plugin";
import stripJsonComments from "strip-json-comments";

import {
  type WorkflowSuiteFileOptions,
  type WorkflowSuiteOptions,
  workflowSuiteFileOptionsSchema,
} from "./workflow-suite-options";

const CONFIG_FILENAMES = [
  "opencode-workflow-suite.config.jsonc",
  "opencode-workflow-suite.config.json",
  ".opencode/workflow-suite.config.jsonc",
  ".opencode/workflow-suite.config.json",
] as const;

const findConfigPath = (input: PluginInput): string | undefined => {
  const roots = new Set<string>();
  if (typeof input.directory === "string" && input.directory.length > 0) {
    roots.add(input.directory);
  }
  if (typeof input.worktree === "string" && input.worktree.length > 0) {
    roots.add(input.worktree);
  }
  roots.add(process.cwd());

  for (const root of roots) {
    for (const filename of CONFIG_FILENAMES) {
      const candidate = path.join(root, filename);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
};

const formatIssuePath = (pathParts: Array<string | number>): string => {
  if (pathParts.length === 0) {
    return "(root)";
  }

  return pathParts
    .map((segment) => {
      return typeof segment === "number" ? `[${segment}]` : segment;
    })
    .join(".");
};

const parseConfig = (
  raw: string,
  configPath: string
): WorkflowSuiteFileOptions => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonComments(raw));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to parse workflow suite config at ${configPath}: ${message}`
    );
  }

  const validated = workflowSuiteFileOptionsSchema.safeParse(parsed);
  if (!validated.success) {
    const details = validated.error.issues
      .map((issue) => {
        return `${formatIssuePath(issue.path)}: ${issue.message}`;
      })
      .join("; ");
    throw new Error(
      `Invalid workflow suite config at ${configPath}: ${details}`
    );
  }

  return validated.data;
};

export const loadWorkflowSuiteOptionsFromFile = (
  input: PluginInput
): WorkflowSuiteFileOptions | undefined => {
  const configPath = findConfigPath(input);
  if (!configPath) {
    return undefined;
  }

  const raw = readFileSync(configPath, "utf8");
  return parseConfig(raw, configPath);
};

export const mergeWorkflowSuiteOptions = (
  fileOptions?: WorkflowSuiteFileOptions,
  directOptions?: WorkflowSuiteOptions
): WorkflowSuiteOptions | undefined => {
  if (!(fileOptions || directOptions)) {
    return undefined;
  }

  return {
    modules: {
      ...fileOptions?.modules,
      ...directOptions?.modules,
    },
    todoEnforcer: {
      ...fileOptions?.todoEnforcer,
      ...directOptions?.todoEnforcer,
      guards: {
        ...fileOptions?.todoEnforcer?.guards,
        ...directOptions?.todoEnforcer?.guards,
      },
    },
    notifier: {
      ...fileOptions?.notifier,
      ...directOptions?.notifier,
      quietHours: {
        ...fileOptions?.notifier?.quietHours,
        ...directOptions?.notifier?.quietHours,
      },
      events: {
        ...fileOptions?.notifier?.events,
        ...directOptions?.notifier?.events,
      },
      command: {
        ...fileOptions?.notifier?.command,
        ...directOptions?.notifier?.command,
      },
      focusCommand: {
        ...fileOptions?.notifier?.focusCommand,
        ...directOptions?.notifier?.focusCommand,
      },
    },
  };
};
