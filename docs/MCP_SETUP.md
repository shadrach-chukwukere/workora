# Workora MCP & AI assistant integration — setup and handover

## 1. Architecture

| Layer | Implementation |
| --- | --- |
| Web app | Next.js 16 App Router (`src/app`), deployed on Vercel. Brand palette lives in `src/app/globals.css` (`--color-brand-*`). |
| API | Fastify 5 under `apps/api/src`, Kysely + PostgreSQL, better-auth sessions, response envelope `{ success, message, data }`. |
| Identity | Better Auth remains the only user identity/session provider. OAuth here issues **API tokens only** for third-party AI clients. |
| MCP server | Official `@modelcontextprotocol/sdk` v1 (Streamable HTTP). Stateless transport at `POST/GET/DELETE /api/mcp`, registered in `apps/api/src/app.ts`. |
| Tools | One validated operation per action in `apps/api/src/modules/agent/operations.ts`; the MCP server, agent REST API and WebMCP all call the same operations. |
| OAuth server | `apps/api/src/modules/oauth/` — metadata, consent, codes (PKCE S256), opaque access/refresh tokens, revocation, CIMD + DCR, connections and audit log. |
| Database | New tables in migration `0019_mcp_oauth`; agent idempotency in `0020_agent_idempotency`. No new database. |

Public MCP endpoint: `https://workora.com/api/mcp` (Next.js rewrite forwards to the backend).

## 2. Discovery endpoints

| Purpose | Public path | Backend route |
| --- | --- | --- |
| MCP | `/api/mcp` | `/api/mcp` |
| Authorization Server metadata (RFC 8414) | `/.well-known/oauth-authorization-server` | `/api/v1/oauth/metadata` |
| Protected Resource metadata (RFC 9728) | `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp` | `/api/v1/oauth/protected-resource` |
| Consent screen | `/oauth/authorize` | (Next.js page, posts to `/api/oauth/authorize`) |
| Token | `/api/oauth/token` | `/api/v1/oauth/token` |
| Dynamic registration | `/api/oauth/register` | `/api/v1/oauth/register` |
| Revocation | `/api/oauth/revoke` | `/api/v1/oauth/revoke` |
| Dashboard connections | `/api/oauth/connections` | `/api/v1/oauth/connections` |

The 401 challenge includes `WWW-Authenticate: Bearer resource_metadata="…", scope="…"` so MCP clients can discover the flow automatically.

## 3. Environment variables

Backend (`apps/api/.env`, placeholders in `apps/api/.env.example`):

```dotenv
MCP_ENABLED=true
MCP_ISSUER_URL=https://workora.com
MCP_RESOURCE_URL=https://workora.com/api/mcp
MCP_ACCESS_TOKEN_TTL_SECONDS=3600
MCP_REFRESH_TOKEN_TTL_SECONDS=2592000
```

Frontend/Vercel: `API_URL` must point at the backend origin; `NEXT_PUBLIC_API_URL` must stay empty so browser calls remain same-origin. No MCP secrets live in the frontend.

## 4. Migrations

`npm run migrate` in `apps/api` applies `0019_mcp_oauth` and `0020_agent_idempotency`. These migrations only **create** tables/indexes — existing data is never reset.

## 5. Tools and permissions

The authoritative tool list lives in `apps/api/src/modules/agent/operations.ts` (`AGENT_OPERATIONS`) and is mirrored on the public page `/developers/mcp`.

- Public, anonymous: job/freelancer search, public details/portfolio, sign-up URL.
- Scoped: `profile:read/write`, `projects:read`, `jobs:read/write`, `proposals:read/write`, `invitations:read/write`, `contracts:read`, `notifications:read`, `connections:read`, `messages:read/write`.
- Consequential writes (`publish_job`, `invite_freelancer`, `submit_proposal`, `review_application`, `respond_to_invitation`, `send_message`, `update_profile`) are **two-step**: the first call returns a preview + HMAC-signed confirmation token and writes nothing; the second call must repeat the same parameters with the token.
- Workora has no stored proposal-draft state. `create_proposal_draft` returns a transient signed preview consumed by `submit_proposal`; no fake draft records are created.
- No tool moves money, funds milestones, accepts contracts, changes passwords, or bypasses verification/CAPTCHA.

## 6. Client connection instructions

**ChatGPT:** ChatGPT Plugins → **+ Add custom MCP server** → enter `https://workora.com/api/mcp` → review the risk notice → create as a plugin → install → sign in to Workora and approve scopes.

**Claude:** Claude connector settings → **Add custom connector** → enter the URL → start a chat and connect → sign in to Workora and approve scopes.

Workora is **not** officially listed in either platform's directory. Both flows are custom connectors configured by the user in their own workspace.

## 7. Verification

- Backend types: `npx tsc --noEmit -p apps/api/tsconfig.json`
- Backend tests: `npm test` in `apps/api` (includes OAuth, MCP protocol, tool and cross-user tests where present)
- Frontend types/build: `npx tsc --noEmit`, `npm run build`
- MCP Inspector: connect to `https://workora.com/api/mcp` (or `http://localhost:3000/api/mcp` locally) and inspect `tools/list` and `tools/call`.
- Local handshake: `curl -X POST http://localhost:3000/api/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'`

Actual ChatGPT/Claude compatibility requires credentials and accounts and must be verified manually; local protocol tests alone are not proof of a published integration.

## 8. Deployment checklist (manual actions)

1. Apply migrations on production PostgreSQL (`npm run migrate`).
2. Set backend env (`MCP_ISSUER_URL`, `MCP_RESOURCE_URL`, TTLs) to the production domain; keep secrets only in the platform's env settings.
3. Confirm Vercel rewrites for `/api/mcp`, `/api/oauth/*` and the `/.well-known/*` paths resolve to the Render backend over HTTPS.
4. Check `WWW-Authenticate` and metadata documents from a browser on the production domain.
5. Register the custom connector in ChatGPT and Claude with your own accounts and complete the consent flow once per client.
6. Confirm revocation from `/settings/integrations` immediately stops tool calls.
7. Keep `MCP_ENABLED=true`; set to `false` to disable the endpoint without touching other features.

## 9. Security notes

- Tokens are opaque random values stored only as SHA-256 hashes; access tokens expire; refresh tokens rotate and replay detection revokes the whole family.
- Dynamic registration is public by design (per MCP spec) but rate limited and restricted to https/loopback redirect URIs; CIMD documents are fetched with SSRF protections and cached.
- Every private operation is bound to the token's user id and role; cross-user access returns not found/forbidden.
- Marketplace content is always treated as untrusted data; tool output cannot change permissions or business rules.
- Error responses from MCP tools are sanitized — no SQL, stack traces, tokens or other users' data.

## 10. Known limitations

- `@modelcontextprotocol/sdk` v1 implements MCP spec 2025-11-25; 2026-07-28 features are not claimed. A v2 SDK migration is a documented follow-up.
- Anonymous public tools are intentionally readable without a token; all private tools require authorization.
- `private_key_jwt` CIMD clients are not supported; only public clients (`token_endpoint_auth_method: none`) with PKCE.
- No official ChatGPT/Claude directory listing has been requested or approved.
