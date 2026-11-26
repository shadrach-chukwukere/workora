# Workora AI agent integration — developer guide

## Architecture

```text
Browser UI / WebMCP  ─┐
REST clients         ─┼─> apps/api/src/modules/agent/operations.ts
MCP tools (/api/mcp) ─┘          │  (one Zod schema + permission check + handler per operation)
                                 ├─> existing Workora services (projects, proposals, messages, contracts, …)
                                 └─> OpenAPI 3.1 generator (apps/api/src/modules/agent/routes.ts)
```

Nothing is duplicated across transports:

- `apps/api/src/modules/agent/schemas.ts` — the only input/output schema definitions.
- `apps/api/src/modules/agent/operations.ts` — the only implementation and permission checks.
- `apps/api/src/modules/mcp/server.ts` — a thin registry adapter that exposes those operations as MCP tools (official `@modelcontextprotocol/sdk` v1, Streamable HTTP).
- `apps/api/src/modules/mcp/routes.ts` — stateless Streamable HTTP transport at API path `/mcp`, publicly proxied as `https://<web-origin>/api/mcp`.
- `apps/api/src/modules/agent/routes.ts` — the same operations over REST under `/api/v1/agent/*`, plus `/openapi.json` generated from the same schemas.
- `src/components/agent/webmcp-tools.tsx` — feature-detected WebMCP registration; calls the same REST endpoints in the logged-in browser session.

Authentication is unchanged: Better Auth cookie sessions for humans; OAuth 2.1 bearer tokens are issued only after an explicit consent click at `/oauth/authorize`. Tokens live in migration `0019_mcp_oauth`; idempotency records in `0020_agent_idempotency`. No new database or identity provider.

## Protocol support (important)

The current MCP specification revision is **2026-07-28**. The installed official TypeScript SDK (`@modelcontextprotocol/sdk` 1.32.2) implements **2025-11-25**; v1 does not implement the 2026-07-28 stateless handshake, `server/discover`, `resultType`, or `Mcp-*` request headers. This server therefore speaks the 2025-11-25 Streamable HTTP revision. Do not assume 2026-07-28-only clients can connect. Migrating to the v2 packages (`@modelcontextprotocol/server`, `@modelcontextprotocol/client`) is a separate follow-up.

WebMCP is a W3C Community Group draft (24 Nov 2026) using `document.modelContext`, **not** `navigator.modelContext`. Browsers without support are untouched.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `POST https://<web-origin>/api/mcp` | MCP Streamable HTTP (JSON responses, stateless) |
| `GET https://<web-origin>/.well-known/oauth-protected-resource` and `/.../api/mcp` | RFC 9728 protected resource metadata |
| `GET https://<web-origin>/.well-known/oauth-authorization-server` | RFC 8414 authorization server metadata |
| `POST /oauth/authorize` (API: `/api/v1/oauth/authorize`) | Consent submission, session required |
| `POST /api/oauth/token`, `/api/oauth/register`, `/api/oauth/revoke` | Token, DCR/CIMD and revocation endpoints |
| `GET /oauth/authorize` (web page) | Consent screen; requires a logged-in browser |
| `GET /api/v1/oauth/connections`, `DELETE /api/v1/oauth/connections/:id` | User's connected agents, settings page |
| `GET /openapi.json` | Generated OpenAPI 3.1 document |
| `GET/POST /api/agent/*` | Bearer-preserving proxy to the same REST operations (see OpenAPI) |

## Tools and scopes

`AGENT_OPERATIONS` is authoritative. Names:

- Marketplace read (authenticated, `projects:read` / `freelancers:read`): `search_jobs`, `get_job_details`, `search_freelancers`, `get_freelancer_profile`, `get_freelancer_portfolio`, `get_signup_url` (the signup-link tool requires `profile:read`).
- Private read: `get_recommended_projects`, `get_client_projects`, `get_my_profile`, `get_my_proposals`, `get_my_applications`, `get_my_messages`, `get_my_contracts`, `get_my_notifications`, `get_my_connections`, `get_my_invitations`, `get_account_summary`.

**Every tool requires a valid user-bound token, including read-only marketplace tools. There are no anonymous MCP tool calls and no shared credentials.** Protocol discovery is only possible after authentication; unauthenticated requests receive the OAuth 401 challenge.
- Write (draft/prepare or two-step confirm): `update_profile`, `create_job_draft`, `publish_job`, `invite_freelancer`, `create_proposal_draft`, `submit_proposal`, `review_application`, `respond_to_invitation`, `send_message`.

Scopes: `freelancers:read`, `jobs:read`, `jobs:write`, `projects:read`, `profile:read`, `profile:write`, `proposals:read`, `proposals:write`, `messages:read`, `messages:write`, `invitations:read`, `invitations:write`, `contracts:read`, `notifications:read`, `connections:read`.

Role checks reuse `AuthedUser.accountType`; even with a valid token, a freelancer cannot publish a job and a client cannot submit a proposal. Private rows are always filtered by the authenticated user's id.

## Two-step confirmation and idempotency

Consequential operations return HTTP 202 / tool result `{success:false, requiresConfirmation:true, confirmationToken, preview}` on the first call. Nothing is written. Repeat with the same arguments **and** the token to perform the action. Tokens are HMAC-signed with `AUTH_SECRET`, bound to the user + action + exact parameters, and expire after 10 minutes.

`create_job_draft`, `publish_job`, `invite_freelancer`, `submit_proposal`, `review_application`, `respond_to_invitation` and `send_message` accept `idempotencyKey` (or the `Idempotency-Key` HTTP header). Results are stored for 24 hours in `agent_idempotency`, so retries do not duplicate jobs, proposals or messages.

## Errors and rate limits

- MCP tool errors use `isError: true` with `{success:false, message, error:{code}}`; internal errors are replaced with a generic message.
- HTTP REST uses the existing envelope `{success:false, message, error:{code}}`.
- OAuth failures use `401` (invalid/expired token, with `WWW-Authenticate` + `resource_metadata`) and `403 insufficient_scope` with the required scope.
- MCP and REST apply per-user, per-client and per-IP throttles (180 requests/minute) on top of the global API limit; `429` includes `Retry-After`.

## Deployment checklist

1. Set `WEB_APP_URL` to the public HTTPS origin on the API; set `MCP_ISSUER_URL` to the same origin and `MCP_RESOURCE_URL` to `https://<origin>/api/mcp`.
2. Run migrations (`npm run migrate` in `apps/api`).
3. Keep the Next.js Route Handlers (`/api/mcp`, `/api/agent/*`) and rewrites (`/openapi.json`, `/.well-known/*`, `/api/oauth/*`, `/api/v1/*`, `/api/auth/*`). The Route Handlers forward Authorization; config rewrites can drop Bearer headers.
4. Allow the web origin in `CORS_ORIGINS` and keep HTTPS termination at the platform (MCP rejects `http` forwarded protocol in production).
5. Configure assistant connections in ChatGPT/Claude with the MCP URL `https://<origin>/api/mcp` and complete OAuth in the browser. Never paste a Workora password or session cookie into an assistant.

## Testing

- `cd apps/api && npm run typecheck && npm test` — includes MCP Inspector-equivalent protocol calls via Fastify injection (tools/list, tools/call, 401/403 challenges, validation, origin checks) and OpenAPI/metadata tests.
- MCP Inspector: `npx @modelcontextprotocol/inspector`, transport "Streamable HTTP", URL `https://<origin>/api/mcp`, then "Connect" → OAuth flow. Test both `legacy` and (if using an updated Inspector) modern protocol eras; this server implements 2025-11-25.
- Validate OpenAPI at `/openapi.json` with `npx @redocly/cli lint` or Swagger Editor.
- Sitemap/robots/JSON-LD: use Google Rich Results Test and a robots.txt tester against the deployed origin.
- WebMCP: only browsers implementing `document.modelContext` can exercise it; otherwise verify the page renders identically (regression).

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `401 invalid_token` | Token expired/revoked or audience mismatch. Reconnect the assistant; check `MCP_RESOURCE_URL` equals the public `/api/mcp` URL. |
| `403 insufficient_scope` | Reconnect with the scope named in `WWW-Authenticate`. |
| Browser client gets `403 invalid_origin` | `Origin` header host differs from the issuer host. Use the canonical web origin. |
| `202 requiresConfirmation` repeated | Confirmation token must be passed unchanged with identical arguments within 10 minutes. |
| `409 CONFLICT` on retry | Idempotency key was reused with different parameters. |
| Tools missing for a user | Tool list is global, but protected calls fail scope/role checks; verify granted scopes on the `/oauth/authorize` consent screen or via the OAuth API. |
| `/api/v1/mcp/connections` 404 | Use `/api/oauth/connections` (rewritten to the real OAuth module route). |
