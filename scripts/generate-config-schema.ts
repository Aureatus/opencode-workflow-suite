import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { zodToJsonSchema } from "zod-to-json-schema";

import { workflowSuiteFileOptionsSchema } from "../src/workflow-core/workflow-suite-options";

const OUTPUT_PATH = path.join(
  process.cwd(),
  "schema",
  "workflow-suite.config.schema.json"
);

const STABLE_SCHEMA_URI =
  "https://unpkg.com/opencode-workflow-suite/schema/workflow-suite.config.schema.json";

const createSchemaDocument = (): Record<string, unknown> => {
  const schema = zodToJsonSchema(workflowSuiteFileOptionsSchema, {
    $refStrategy: "none",
    target: "jsonSchema2020-12",
  }) as Record<string, unknown>;

  return {
    ...schema,
    $id: STABLE_SCHEMA_URI,
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "OpenCode Workflow Suite Config",
  };
};

const stringifySchema = (value: unknown): string => {
  return `${JSON.stringify(value, null, 2)}\n`;
};

async function main(): Promise<void> {
  const content = stringifySchema(createSchemaDocument());
  const checkMode = process.argv.includes("--check");

  if (checkMode) {
    const existing = await readFile(OUTPUT_PATH, "utf8").catch(() => "");
    if (existing !== content) {
      throw new Error(
        "Schema is out of date. Run `bun run schema:generate` to refresh schema/workflow-suite.config.schema.json."
      );
    }
    return;
  }

  await writeFile(OUTPUT_PATH, content, "utf8");
}

await main();
