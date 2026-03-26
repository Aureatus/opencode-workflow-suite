# Repo Local

This module provides `repo_ensure_local`, vendored from `opencode-repo-local`.

## Behavior contract

- normalize supported repo inputs (`owner/repo`, `host/owner/repo`, `https://...`, optional SSH)
- ensure local availability by cloning or updating under clone root
- return stable result fields including `local_path`, ref/SHA metadata, and freshness counts

## Tool

- name: `repo_ensure_local`
- entrypoint: `tools/repo-ensure-local.ts`

## Update strategy

- default `update_mode` is `ff-only` (safe default)
- also supports `fetch-only` and `reset-clean`

## Environment variables

- `OPENCODE_REPO_CLONE_ROOT` (absolute path override)
- `OPENCODE_REPO_ALLOW_SSH=true`
- `OPENCODE_REPO_TELEMETRY_PATH`

## Validation

- `test/repo-local-url.test.ts`
- `test/repo-local-auth.test.ts`
- `test/repo-local-paths.test.ts`
- `test/repo-local-git.test.ts`
