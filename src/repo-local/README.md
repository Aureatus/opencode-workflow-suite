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

## Key arguments

- `clone_root` (absolute path override for local clone root)
- `allow_ssh` (explicitly allow SSH-style URLs)
- `auth_mode` (`auto`, `https`, `ssh`)

## Validation

- `test/repo-local-url.test.ts`
- `test/repo-local-auth.test.ts`
- `test/repo-local-paths.test.ts`
- `test/repo-local-git.test.ts`
