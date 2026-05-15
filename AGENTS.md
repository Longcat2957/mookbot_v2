# Codex Harness

This repository uses Codex as the local coding agent harness.

## Project Shape

- Monorepo managed by `pnpm`.
- Frontend activity app: `apps/activity`.
- API service: `apps/api`.
- Discord bot: `apps/bot`.
- Shared domain/database package: `packages/core`.

## Default Workflow

1. Inspect the relevant files before editing.
2. Keep changes scoped to the user's request.
3. Prefer existing patterns and helpers over new abstractions.
4. Preserve user changes in the working tree.
5. Run the narrowest useful verification first, then broader checks when behavior changes.

## Common Commands

- Typecheck all packages: `pnpm typecheck`
- Run all tests: `pnpm test`
- Build all packages: `pnpm build`
- Biome check: `pnpm check`
- Biome fix: `pnpm check:fix`
- Activity-only typecheck: `pnpm --filter @mookbot/activity typecheck`
- Activity-only build: `pnpm --filter @mookbot/activity build`
- Core tests: `pnpm --filter @mookbot/core test`

## Safety Rules

- Do not run destructive git commands unless explicitly requested.
- Do not use `git reset --hard`, `git clean -f`, or force-push as routine cleanup.
- Do not run destructive database commands such as migration drops or direct production D1 mutation without explicit approval.
- Do not commit secrets or local environment files.
- Treat `.env`, `.env.local`, `.claude/`, and `.codex/` as local-only state.

## Release Notes

One-person development flow is main-branch oriented. The normal release path is:

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm version:patch
pnpm deploy:vps
```

Only run deployment commands when the user asks for release/deploy work.
