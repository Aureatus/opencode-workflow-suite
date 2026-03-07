import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { DEBUG_PING_FILENAME } from "../src/todo-enforcer/debug-tool";

type E2EMode = "local" | "npm";

interface RunEnvironment {
  cwd: string;
  envOverrides: Record<string, string>;
}

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface TelemetryEvent {
  event: "todo_enforcer";
  kind: string;
  session_id?: string;
  reason?: string;
  context?: string;
  timestamp: number;
}

interface E2ECase {
  id: string;
  prompt: string;
  assert: (input: {
    events: TelemetryEvent[];
    result: CommandResult;
    caseDirectory: string;
  }) => Promise<void> | void;
}

const E2E_STOP_COMMAND = "STOP_TODO_CONTINUATION_NOW";

const E2E_NPM_SANDBOX_DIRECTORY = path.join(
  os.homedir(),
  ".cache",
  "opencode-workflow-suite",
  "npm-e2e-sandbox"
);

const COMMAND_TIMEOUT_MS = 180_000;
const COMMAND_RETRY_DELAY_MS = 5000;
const MAX_COMMAND_ATTEMPTS = Number.parseInt(
  process.env.OPENCODE_TODO_ENFORCER_E2E_MAX_ATTEMPTS ?? "2",
  10
);
const STRICT_TELEMETRY =
  process.env.OPENCODE_TODO_ENFORCER_E2E_STRICT === "true";
const RETRYABLE_FAILURE_PATTERN =
  /timed out|timeout|rate limit|429|502|503|504|econnreset|etimedout|enotfound|eai_again|network/i;

function parseMode(argv: string[]): E2EMode {
  const modeArgIndex = argv.indexOf("--mode");
  if (modeArgIndex === -1) {
    return "local";
  }

  const selected = argv[modeArgIndex + 1];
  if (selected === "npm" || selected === "local") {
    return selected;
  }

  throw new Error(
    `Invalid --mode value: ${selected ?? "<missing>"}. Use --mode local or --mode npm.`
  );
}

async function assertDistBuildExists(projectDirectory: string): Promise<void> {
  const distEntry = path.join(projectDirectory, "dist", "index.mjs");
  try {
    const info = await stat(distEntry);
    if (!info.isFile()) {
      throw new Error("dist index is not a file");
    }
  } catch {
    throw new Error(
      `Missing dist build at ${distEntry}. Run \`bun run build\` before \`bun run test:e2e\`.`
    );
  }
}

async function buildRunEnvironment(
  mode: E2EMode,
  projectDirectory: string
): Promise<RunEnvironment> {
  if (mode === "npm") {
    await mkdir(E2E_NPM_SANDBOX_DIRECTORY, { recursive: true });
    return {
      cwd: E2E_NPM_SANDBOX_DIRECTORY,
      envOverrides: {
        OPENCODE_CONFIG_CONTENT: JSON.stringify({
          plugin: ["opencode-workflow-suite"],
        }),
        OPENCODE_TODO_ENFORCER_STOP_COMMAND: E2E_STOP_COMMAND,
      },
    };
  }

  await assertDistBuildExists(projectDirectory);
  const localPluginSpec = `opencode-workflow-suite@file:${projectDirectory}`;
  return {
    cwd: projectDirectory,
    envOverrides: {
      OPENCODE_CONFIG_CONTENT: JSON.stringify({
        plugin: [localPluginSpec],
      }),
      OPENCODE_TODO_ENFORCER_STOP_COMMAND: E2E_STOP_COMMAND,
    },
  };
}

function runOpencodeCommand(
  prompt: string,
  telemetryPath: string,
  context: string,
  runEnvironment: RunEnvironment,
  caseCwd: string
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("opencode", ["run", prompt], {
      cwd: caseCwd,
      env: {
        ...process.env,
        ...runEnvironment.envOverrides,
        OPENCODE_TODO_ENFORCER_TELEMETRY_PATH: telemetryPath,
        OPENCODE_TODO_ENFORCER_TELEMETRY_CONTEXT: context,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`opencode run timed out after ${COMMAND_TIMEOUT_MS}ms`));
    }, COMMAND_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

function parseTelemetry(raw: string): TelemetryEvent[] {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const events: TelemetryEvent[] = [];
  for (const line of lines) {
    const parsed = JSON.parse(line) as TelemetryEvent;
    if (parsed.event === "todo_enforcer") {
      events.push(parsed);
    }
  }

  return events;
}

async function readTelemetryEvents(
  telemetryPath: string
): Promise<TelemetryEvent[]> {
  try {
    const raw = await readFile(telemetryPath, "utf8");
    return parseTelemetry(raw);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function shouldRetryFailure(stdout: string, stderr: string): boolean {
  return RETRYABLE_FAILURE_PATTERN.test(`${stdout}\n${stderr}`);
}

function shouldRetryAssertionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Debug ping file not found");
}

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

function ensure(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertStopCase(input: {
  events: TelemetryEvent[];
  result: CommandResult;
}): void {
  const { events, result } = input;
  const sawStopSet = events.some((entry) => entry.kind === "stop_set_chat");
  const stdoutLower = result.stdout.toLowerCase();
  const stopAckInStdout =
    stdoutLower.includes("stop") || stdoutLower.includes("continuation");
  ensure(
    sawStopSet || stopAckInStdout,
    `Expected stop acknowledgement via telemetry/stdout, got events=[${events.map((event) => event.kind).join(", ")}], stdout=${result.stdout}`
  );
}

function assertChatMessageCase(input: {
  events: TelemetryEvent[];
  result: CommandResult;
}): void {
  const { events, result } = input;
  const sawChatMessage = events.some(
    (entry) => entry.kind === "chat_message_seen"
  );
  const sawOk = result.stdout.toUpperCase().includes("OK");
  ensure(
    sawChatMessage || sawOk,
    `Expected chat acknowledgement via telemetry/stdout, got events=[${events.map((event) => event.kind).join(", ")}], stdout=${result.stdout}`
  );
}

async function assertDebugToolCase(input: {
  caseDirectory: string;
  result: CommandResult;
}): Promise<void> {
  const { caseDirectory, result } = input;
  const pingPath = path.join(caseDirectory, DEBUG_PING_FILENAME);

  let content = "";
  try {
    content = await readFile(pingPath, "utf8");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown read error";
    throw new Error(
      `Debug ping file not found at ${pingPath}. stdout=${result.stdout}\nstderr=${result.stderr}\nerror=${message}`
    );
  }

  ensure(
    content.includes("debug_ping"),
    "debug ping file missing debug_ping event"
  );
  ensure(
    content.includes("e2e-debug-tool"),
    "debug ping file missing expected marker"
  );
}

function buildCases(): E2ECase[] {
  return [
    {
      id: "stop-command",
      prompt: E2E_STOP_COMMAND,
      assert: assertStopCase,
    },
    {
      id: "chat-message",
      prompt: "Automated verification prompt. Reply with exactly OK.",
      assert: assertChatMessageCase,
    },
    {
      id: "debug-tool",
      prompt:
        "Call the tool todo_enforcer_debug_ping with marker 'e2e-debug-tool'. Then respond with exactly TOOL_OK.",
      assert: assertDebugToolCase,
    },
  ];
}

async function runCaseWithRetry(args: {
  runCase: E2ECase;
  telemetryPath: string;
  runEnvironment: RunEnvironment;
  caseCwd: string;
}): Promise<{ events: TelemetryEvent[]; result: CommandResult }> {
  const { runCase, telemetryPath, runEnvironment, caseCwd } = args;

  let attempt = 1;
  while (attempt <= MAX_COMMAND_ATTEMPTS) {
    const context = `${runCase.id}-attempt-${attempt}`;
    let result: CommandResult;
    try {
      result = await runOpencodeCommand(
        runCase.prompt,
        telemetryPath,
        context,
        runEnvironment,
        caseCwd
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        attempt < MAX_COMMAND_ATTEMPTS &&
        RETRYABLE_FAILURE_PATTERN.test(message)
      ) {
        await sleep(COMMAND_RETRY_DELAY_MS * attempt);
        attempt += 1;
        continue;
      }
      throw error;
    }

    const allEvents = await readTelemetryEvents(telemetryPath);
    const scopedEvents = allEvents.filter((event) => event.context === context);

    try {
      ensure(
        result.code === 0,
        `opencode run failed for case ${runCase.id} (code ${result.code})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
      );

      if (scopedEvents.length === 0 && !STRICT_TELEMETRY) {
        return { events: scopedEvents, result };
      }

      await runCase.assert({
        events: scopedEvents,
        result,
        caseDirectory: caseCwd,
      });
      return { events: scopedEvents, result };
    } catch (error) {
      if (
        attempt < MAX_COMMAND_ATTEMPTS &&
        (shouldRetryFailure(result.stdout, result.stderr) ||
          shouldRetryAssertionError(error))
      ) {
        await sleep(COMMAND_RETRY_DELAY_MS * attempt);
        attempt += 1;
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Exhausted attempts for case ${runCase.id}`);
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  const keep = process.env.OPENCODE_TODO_ENFORCER_E2E_KEEP === "true";
  const projectDirectory = process.cwd();
  const runEnvironment = await buildRunEnvironment(mode, projectDirectory);
  const cases = buildCases();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "opencode-todo-e2e-"));
  const telemetryPath = path.join(tempRoot, "telemetry.jsonl");

  const summary: Array<{
    id: string;
    events: string[];
    stdoutTail: string;
  }> = [];

  try {
    for (const runCase of cases) {
      const caseCwd = path.join(tempRoot, runCase.id);
      await mkdir(caseCwd, { recursive: true });

      const { events, result } = await runCaseWithRetry({
        runCase,
        telemetryPath,
        runEnvironment,
        caseCwd,
      });

      const stdoutTail = result.stdout.trim().split("\n").slice(-5).join("\n");
      summary.push({
        id: runCase.id,
        events: events.map((event) => event.kind),
        stdoutTail,
      });
    }

    console.log("E2E test passed");
    console.log(
      JSON.stringify(
        { mode, strictTelemetry: STRICT_TELEMETRY, summary },
        null,
        2
      )
    );
  } finally {
    if (!keep) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }
}

await main();
