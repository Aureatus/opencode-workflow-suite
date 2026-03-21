import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { RepoPluginError } from "./errors";
import type { ParsedRepoUrl } from "./types";

const DEFAULT_CLONE_ROOT = "~/.opencode/repos";

function expandHome(input: string): string {
  if (input === "~") {
    return os.homedir();
  }

  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }

  return input;
}

function sanitizeSegment(segment: string): string {
  const sanitized = segment
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!sanitized) {
    throw new RepoPluginError(
      "INVALID_URL",
      `Could not derive a safe path segment from: ${segment}`
    );
  }
  return sanitized;
}

function ensureWithinRoot(root: string, target: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const prefix = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : `${resolvedRoot}${path.sep}`;

  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(prefix)) {
    throw new RepoPluginError(
      "PATH_VIOLATION",
      "Resolved repository path escaped clone root"
    );
  }
}

export async function resolveCloneRoot(): Promise<string> {
  const fromEnv = process.env.OPENCODE_REPO_CLONE_ROOT?.trim();
  const selected = fromEnv || DEFAULT_CLONE_ROOT;
  const expanded = expandHome(selected);

  if (fromEnv && !path.isAbsolute(expanded)) {
    throw new RepoPluginError(
      "INVALID_CLONE_ROOT",
      "OPENCODE_REPO_CLONE_ROOT must be an absolute path"
    );
  }

  const root = path.resolve(expanded);
  await mkdir(root, { recursive: true });
  return root;
}

export function buildRepoPath(cloneRoot: string, repo: ParsedRepoUrl): string {
  const safeSegments = repo.pathSegments.map(sanitizeSegment);
  const target = path.resolve(cloneRoot, repo.host, ...safeSegments);
  ensureWithinRoot(cloneRoot, target);
  return target;
}
