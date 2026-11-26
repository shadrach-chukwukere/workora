# Final report — Workora MCP / OAuth / AI discoverability

Date: 2026-11-26

## What was built

- **One shared operation layer** (`apps/api/src/modules/agent/`): `schemas.ts` (Zod inputs/outputs), `operations.ts` (validated, permission-checked handlers), `routes.ts` (REST + generated OpenAPI 3.1).
- **One remote MCP server** (`apps/api/src/modules/mcp/`): official `@modelcontextprotocol/sdk` v1 Streamable HTTP transport at API `/mcp`, published as `/api/mcp`. Every MCP request requires a user-bound OAuth bearer token; no anonymous tool calls.
- **OAuth 2.1 authorization server** (existing `apps/api/src/modules/oauth/`, hardened): PKCE S256, DCR + CIMD, authorization-code exchange, rotating refresh tokens with replay detection, revocation, exact HTTPS / port-agnostic loopback redirect validation, RFC 9728 / RFC 8414 metadata. Browser consent screen at `/oauth/authorize` using the existing Better Auth session only.
- **Agent REST endpoints** `/api/v1/agent/*`, exposed through a Bearer-preserving proxy at `/api/agent/*`; `/openapi.json` generated from the shared schemas.
- **WebMCP** feature-detected registration on public job/freelancer pages and job-detail pages using the same REST endpoints; nothing changes in unsupported browsers. No connection-dashboard tools were added.
- **Discoverability**: `robots.ts`, dynamic `sitemap.ts`, JSON-LD (Organization/WebSite/SearchAction, JobPosting, Person+ProfilePage, Organization), per-page metadata, `/ai` technical docs, `/llms.txt`. Stale `next-sitemap` postbuild artifacts were removed.
- **Policies**: `/privacy` and `/terms` updated for agent access, AI-provider sharing, consent, token security, revocation and acceptable use.
- **Database**: migration `0020_agent_idempotency`; identity/authentication remain exclusively Better Auth + existing tables.

## Endpoints

- MCP: `https://<canonical-origin>/api/mcp`
- OAuth protected-resource metadata: `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/api/mcp`
- OAuth authorization-server metadata: `/.well-known/oauth-authorization-server`
- Authorization (browser consent): `/oauth/authorize` → API `/api/v1/oauth/authorize`
- Token / register / revoke: `/api/oauth/token`, `/api/oauth/register`, `/api/oauth/revoke`
- Connections list/revoke (existing account settings): `/api/oauth/connections`
- OpenAPI: `/openapi.json`
- Agent REST: `/api/agent/*` (Bearer proxy) and `/api/v1/agent/*` (API origin)

## Authentication architecture

Better Auth cookie sessions remain the only identity provider for humans. OAuth issues opaque, short-lived access tokens and rotating refresh tokens only after an explicit consent click in the user's browser; token values are stored as SHA-256 hashes and bound to a user + client + resource. Every MCP request (including `tools/list`) resolves to one user and requires a scope for the operation. REST/WebMCP calls from the website use the normal session; external Bearer calls use the same operation functions and permission checks. No shared account, no password/token in tool responses, no money-movement tools, no CAPTCHA/email/2FA bypass.

## Protected MCP tools (26, all require authentication)

`search_jobs`, `get_job_details`, `search_freelancers`, `get_freelancer_profile`, `get_freelancer_portfolio`, `get_signup_url`, `get_recommended_projects`, `get_client_projects`, `get_my_profile`, `get_my_proposals`, `get_my_applications`, `get_my_messages`, `get_my_contracts`, `get_my_notifications`, `get_my_connections`, `get_my_invitations`, `get_account_summary`, `update_profile`, `create_job_draft`, `publish_job`, `invite_freelancer`, `create_proposal_draft`, `submit_proposal`, `review_application`, `respond_to_invitation`, `send_message`. Consequential writes use two-step signed confirmations; create/submit operations accept idempotency keys.

## Documentation and policy URLs

`/ai` (technical MCP docs), `/openapi.json`, `/llms.txt`, `/privacy`, `/terms`, `/contact`, plus `docs/ai-agents.md`, `docs/agent-capabilities.md`, `docs/manual-steps.md`, `docs/claude-directory-readiness.md`, `docs/MCP_SETUP.md`.

## Tests executed

`cd apps/api && npm test` (serial execution, real PostgreSQL): **30/30 passed**. `npm run typecheck` passed for both the API and the web app, and `npm run build` passed for Next.js. Temporary Inspector test tokens/clients were deleted after verification. Coverage includes anonymous MCP rejection, authenticated reads, expired/revoked/invalid/wrong-scope tokens, cross-user isolation, role restrictions, OAuth consent/code exchange/form-encoded token endpoint/refresh rotation/revocation, PKCE rejection, loopback and hosted redirect matching, two-step confirmation, idempotency, rate limiting, annotations on all tools, OpenAPI/metadata and health checks.

Other verification:
- `npm run typecheck` (web and API) and `npm run build` (Next.js production) passed.
- Official MCP Inspector CLI against the live API: unauthenticated request triggers OAuth challenge; authenticated `tools/list` lists 26 tools with schemas/annotations; authenticated `tools/call search_jobs` returned a valid result.
- Production Next.js server: public pages `/`, `/find-work`, `/find-talent`, `/categories`, `/ai`, `/privacy`, `/terms`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/openapi.json`, `/developers/mcp` returned HTTP 200 without authentication.
- Config rewrites were found to drop `Authorization`; explicit Route Handlers now proxy `/api/mcp` and `/api/agent/*` while preserving Bearer headers. Verified locally: unauthenticated `/api/mcp` → 401 with `resource_metadata`; authenticated → 200; `/api/agent/me` with a token → 200. The API requires HTTPS in production, so local HTTP checks used `X-Forwarded-Proto: https` to simulate deployed TLS.
- Migrations applied locally: `0019_mcp_oauth`, `0020_agent_idempotency`.

## Not tested

- Live Claude connector or ChatGPT connection (no account/credentials were provided). The OAuth endpoints, metadata, PKCE, DCR/CIMD, form-encoded token endpoint and redirect rules were verified locally; live client compatibility remains to be confirmed.
- WebMCP in a supporting browser (feature-detected implementation only; no browser with `document.modelContext` was available).
- Production DNS/TLS and external network reachability; these require deployment.
- Anthropic directory submission/review — not submitted, not approved, not listed, not endorsed.

## Remaining manual tasks

See `docs/manual-steps.md` and `docs/claude-directory-readiness.md`: deploy to the canonical HTTPS origin, set `WEB_APP_URL`/`MCP_ISSUER_URL`/`MCP_RESOURCE_URL`, apply migrations in production, verify discovery endpoints externally, test a real Claude custom connector, create a sample-data test account for Anthropic review, verify business contact details, then submit through Anthropic's developer portal.
