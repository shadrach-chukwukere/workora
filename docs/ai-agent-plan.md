# Workora AI-agent discoverability & MCP — Step 0 audit and plan

Date: 2026-11-26. Scope: make Workora usable by AI agents without redesigning the site.

## Audit summary (verified from the codebase and current specs)

| Area | Finding |
| --- | --- |
| Web | Next.js 16.4.5 App Router, React 19. Public pages are Server Components (`src/app/(site)/*`) that fetch from the API; dashboard sections are role-gated server/client hybrids. Vercel deployment (also `workora-phi.vercel.app`). |
| API | Fastify 5 in `apps/api`, Kysely + PostgreSQL (PGlite for tests), Zod v4, response envelope `{success,message,data}`. Modules registered with `/api/v1` prefix. Render deployment. |
| Auth | Better Auth cookie sessions (`accounts`, `sessions`), verified identity, roles. Separate OAuth 2.1 authorization server already implemented in `apps/api/src/modules/oauth/`; tokens are SHA-256 hashes, PKCE S256, refresh rotation, CIMD + DCR, revocation, migration `0019_mcp_oauth`. |
| Existing MCP work | `@modelcontextprotocol/sdk` ^1.32.2 already installed; `apps/api/src/modules/mcp/{server.ts,data.ts,confirmation.ts,routes.ts}` exist (routes.ts untracked). `server.ts` defines 20 tools; `routes.ts` creates a stateless Streamable HTTP transport but is **imported but never registered** in `app.ts`. OAuth metadata advertises paths that do not match registered routes. Frontend integrations UI calls a non-existent `/api/v1/mcp/connections`. |
| Discoverability | `app/sitemap.ts` has relative URLs and conflicts with stale `public/sitemap.xml`; `public/robots.txt` has no AI agents; no JSON-LD, no canonical/OG/Twitter tags on most public pages; no `/ai` or `/developers/mcp` page although 3 places link to it; no `/llms.txt`. |
| Specs checked | MCP current spec is **2026-07-28**. Official TS SDK v1.32.2 implements **2025-11-25** only; v2 (`@modelcontextprotocol/server` / `@modelcontextprotocol/client`) implements 2026-07-28. WebMCP is a W3C Community Group draft (2026-11-24) exposing **`document.modelContext.registerTool()`** (not `navigator.modelContext`). OpenAI Responses API supports remote MCP via `server_url` + `authorization`; Claude supports remote MCP connectors. |

## What we reuse (no new auth or database)

- Better Auth identity, existing session cookie flow, `requireAuth`/`requireAccountType` helpers.
- `apps/api/src/modules/oauth/*` (authorization server, scopes, tokens, connections, metadata) and migration 0019 — no new OAuth system.
- `apps/api/src/modules/mcp/server.ts`, `data.ts`, `confirmation.ts`, `routes.ts` — extend, do not rewrite.
- Existing services: projects, proposals, invitations, conversations/messages, notifications, contracts, connections, users/freelancers profiles and their Zod schemas.
- Existing public pages and their server-side fetches for JSON-LD and WebMCP (no visual redesign).

## What we add

1. **Transport wiring & correctness**: register the MCP route, serve it publicly at `/api/mcp` via a Next.js rewrite, fix `Origin` validation, `WWW-Authenticate`/resource metadata paths, per-user/per-client/per-IP throttles, auditable tool calls, safe error envelopes, output schemas + annotations on every tool.
2. **Missing tools** (only where a real Workora operation exists): `get_my_messages`, `get_my_applications` (proposal alias), `update_profile`, `send_message` (two-step), client application review (shortlist/reject/accept with confirmation), signup-URL helper (returns the real `/register` URL only). No payment, withdrawal, or money-movement tools.
3. **Shared operation layer**: one Zod schema + one permission check + one handler per agent-facing operation in `apps/api/src/modules/mcp/schemas.ts` / `operations.ts`; MCP tools, the agent REST endpoints, WebMCP and `/openapi.json` all derive from those definitions.
4. **OAuth/discovery endpoints**: correct AS/RS metadata URLs, well-known rewrites, real consent screen at `/oauth/authorize` using the logged-in session, fixed integrations connections API wiring.
5. **Discoverability**: `app/robots.ts`, dynamic `app/sitemap.ts` with `lastmod` (public pages only), JSON-LD (Organization, WebSite+SearchAction, JobPosting, ProfilePage; FAQPage only for real FAQs), per-page metadata/canonical/OG/Twitter, `/ai` public docs, `/llms.txt`.
6. **WebMCP**: feature-detected `document.modelContext` registration on the job listings, job detail, freelancer search/profile and profile settings pages, calling the same endpoints with the same validation as the UI.
7. **OpenAPI 3.1** at `/openapi.json`, generated from shared schemas with an `{success,message,data}` envelope, cursor/page pagination, standard errors and idempotency keys for create/submit endpoints.
8. **Docs, env, tests**: developer docs, public docs, supported/unsupported capabilities, `.env.example` placeholders, MCP/auth/tool/idempotency/rate-limit tests, manual-steps checklist, final report.

## Unsupported / explicitly out of scope (documented for users and agents)

- Payments, payouts, withdrawals, Stripe/Paystack actions, milestone funding or approval, subscriptions, admin actions, identity verification, CAPTCHA/email/2FA bypass, account creation or sign-in through tools.
- No invented jobs, profiles, reviews, ratings or counts; structured data mirrors visible data only.
- 2026-07-28 MCP protocol-era features (stateless handshake, `server/discover`, `resultType`, `Mcp-*` headers) are **not** claimed: the installed v1 SDK speaks 2025-11-25. Migration to v2 packages is a documented follow-up.
- WebMCP support cannot be asserted until tested in a supporting browser; unsupported browsers keep normal behavior.
- Claude and ChatGPT connections are untested without credentials/access; local Inspector and HTTP integration tests are the evidence provided.
- No new database, no new identity provider, no invented integrations.
