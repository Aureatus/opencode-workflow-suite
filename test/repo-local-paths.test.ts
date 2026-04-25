import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildRepoPath, resolveCloneRoot } from "../src/repo-local/lib/paths";
import type { ParsedRepoUrl } from "../src/repo-local/lib/types";

describe("repo-local buildRepoPath", () => {
  test("builds deterministic local paths", () => {
    const parsed: ParsedRepoUrl = {
      raw: "https://github.com/anomalyco/opencode.git",
      host: "github.com",
      pathSegments: ["anomalyco", "opencode"],
      canonicalUrl: "https://github.com/anomalyco/opencode.git",
      key: "github.com/anomalyco/opencode",
    };

    const output = buildRepoPath("/tmp/opencode-repos", parsed);
    expect(output).toBe("/tmp/opencode-repos/github.com/anomalyco/opencode");
  });
});

describe("repo-local resolveCloneRoot", () => {
  test("uses clone_root argument when set", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "repo-local-paths-"));
    const cloneRoot = path.join(tempRoot, "clones");

    try {
      const resolved = await resolveCloneRoot(cloneRoot);
      expect(resolved).toBe(path.resolve(cloneRoot));
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  test("rejects relative clone_root values", async () => {
    await expect(resolveCloneRoot("relative/clones")).rejects.toThrow(
      "clone_root must be an absolute path"
    );
  });
});
