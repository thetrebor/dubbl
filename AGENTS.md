# Agent Rules

## Build & Verification
- Do NOT run full builds (`npm run build`, `next build`, etc.)
- Use lint (`npm run lint`) or typecheck (`npx tsc --noEmit`) instead for verification
- Run dev server (`npm run dev`) only when explicitly asked
- This project uses **Next.js** -- all dev/build/start commands go through `next`
- A successful build is not proof that a UI change is complete or live. For UI work, verify the control/state is actually rendered in the component, the relevant branch is reachable for the target record status, and the API path accepts the exact payload the UI sends.
- For Dockerized production debugging, distinguish source, built image, running container, and browser-loaded bundle. If investigating live behavior, inspect the running container or served bundle for a marker string instead of relying only on local source or build output.
- Do not stop at "route is dynamic" or "build succeeded"; verify the specific user-facing change exists in the built/running artifact when production behavior is the issue.

## MCP Server Conventions
- Every user-facing feature must have corresponding MCP tools
- Keep MCP tools updated when REST API routes change
- Prefer UI/Kuri workflows for routine business operations and UI-sensitive verification; use MCP for repeatable programmatic operations; use REST API for scripted gaps; use direct PostgreSQL only for read-only diagnostics unless explicitly authorized for an emergency repair.
- When adding or changing a user-facing feature, carry it through the control plane before calling it complete: update REST behavior as needed, add or revise MCP tools, register new tool modules in `lib/mcp/tools/index.ts`, and update docs/runbook procedures.
- Tool descriptions must be clear for AI agents -- state input expectations (e.g. "amounts in cents") and what is returned
- All monetary amounts are in integer cents (e.g. $12.50 = 1250)
- MCP tools use direct DB access via Drizzle, not HTTP self-calls
- All tools are org-scoped via `AuthContext` passed at server creation time
- Use `wrapTool()` from `lib/mcp/errors.ts` for consistent error handling
- Tool files live in `lib/mcp/tools/` and export a `registerXTools(server, ctx)` function
- Register new tool files in `lib/mcp/tools/index.ts`
- Use `.describe()` on every Zod field in tool input schemas
- One tool per operation (no multi-purpose tools)

## Database
- All schema changes require Drizzle migration files -- run `npx drizzle-kit generate` after modifying any file in `lib/db/schema/`
- Never use `npx drizzle-kit push` in production -- it applies changes directly without migrations
- Migration files live in `drizzle/` and must be committed alongside schema changes
