# Agent Notes: repo-local

## Scope

Use for edits under `src/repo-local/*`.

## Must Preserve

- Vendored compatibility with `opencode-repo-local`.
- `repo_ensure_local` argument names and result field names.
- Non-interactive git behavior (`GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`).
- Safe default update mode (`ff-only`).

## Change Impact

- If tool schema or result shape changes, update root `README.md` and integration expectations.
- If clone-root/auth behavior changes, verify `repo_ensure_local` argument contracts remain stable.

## Validation

- Fast loop: `bun test test/repo-local-*.test.ts`
- Completion gate before claiming done: `bun run check:full`
