# Repository Guidelines

## Project Structure & Module Organization
YOU MUST treat this workspace as a pnpm monorepo. Operational CLIs live in `scripts/` (`extract.ts`, `upload.ts`, `backup.ts`, `register-provider.ts`), while raw inputs stay in `uploads/` and OCR outputs in `extracted/`—both are gitignored and must remain local. The MCP integration lives in `mcp-server/`; `src/index.ts` wires the tools inside `src/tools/`, and each tool keeps its test beside the implementation. The optional SolidJS client resides in `web/` (Vite app, `src/` components, `dist/` build artifacts).

## Build, Test, and Development Commands
Run `pnpm install` immediately after cloning. Document flows begin with `pnpm extract && pnpm upload`; never mix in manual file copies. Use `pnpm backup` to snapshot SerenDB state and `pnpm register` whenever onboarding an x402 provider mutates `.env`. Develop the MCP server with `pnpm --filter @scan-files/mcp-server dev`, produce Claude Desktop bundles via `pnpm --filter @scan-files/mcp-server build`, and spin up the SolidJS UI through `pnpm --filter @scan-files/web dev`. Stick to `pnpm` for every task to avoid lock drift.

## Coding Style & Naming Conventions
All TypeScript targets ES2022 in `strict` mode with 2-space indentation, single quotes, and explicit named exports. Functions and variables use `camelCase`, classes and types use `PascalCase`, and environment bindings use `UPPER_SNAKE_CASE`. One tool, CLI, or component per file is mandatory; shared helpers belong in `scripts/lib/` or `mcp-server/src/tools/` utilities. Prototype in `tsx`, but graduate anything reusable into the workspace before sharing with Taariq.

## Testing Guidelines
Vitest is the enforcement tool for MCP logic, so mirror the `feature.test.ts` naming used by `mcp-server/src/x402-client.test.ts` and `src/tools/*.test.ts`. YOU MUST mock x402 and SerenDB calls and store fixtures under `mcp-server/src/__fixtures__/`. Before opening a PR, run `pnpm --filter @scan-files/mcp-server test --runInBand` and make sure new payment-validation and query-execution branches are covered.

## Commit & Pull Request Guidelines
Commits follow Conventional Commits (`feat:`, `fix:`, `refactor:`) with ≤72-character imperatives and optional scopes such as `fix(web): guard null`. Never commit `uploads/`, `extracted/`, backups, or secrets. Pull requests must summarize behavioral changes, attach proof of key commands (tests, builds, or extraction pipelines), update docs when workflows shift, cite related Linear issues, and request review from MCP or web maintainers as appropriate. Include `pnpm audit` output whenever dependencies move.

## Security & Configuration Tips
Copy `.env.example`, fill `SERENDB_CONNECTION_STRING`, `X402_*`, and `PROVIDER_WALLET_ADDRESS`, and keep that file local. `pnpm register` rewrites `.env`, so inspect diffs before committing anything. Claude Desktop loads `mcp-server/dist/index.js`; rebuild after altering environment wiring to prevent stale bindings.
