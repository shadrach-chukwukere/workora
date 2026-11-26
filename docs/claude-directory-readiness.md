# Claude Connectors Directory — submission-readiness checklist

Status: **prepared locally, not submitted, not reviewed, not approved, not listed, not endorsed by Anthropic.**
Sources checked: Anthropic's current connector build/authentication, review-criteria and directory-publish documentation (2026-11-26).

| Requirement | Status | Evidence / remaining action |
| --- | --- | --- |
| Remote MCP server using Streamable HTTP | Implemented | `/api/mcp` → Fastify `StreamableHTTPServerTransport`, stateless JSON responses; tested with MCP Inspector CLI and injection tests. |
| Public HTTPS endpoint on port 443 | Pending deployment verification | Configure the canonical domain in Vercel/Render and verify `https://<domain>/api/mcp`. Nothing in this repo can prove production DNS/TLS. |
| OAuth 2.0 / 2.1, per-user authorization | Implemented | Existing Better Auth identity + OAuth module; bearer tokens bound to a user and client. No shared account. |
| OAuth protected-resource metadata (RFC 9728) | Implemented | `/.well-known/oauth-protected-resource` and path-specific variant; `resource` matches `/api/mcp`. |
| Authorization-server metadata (RFC 8414) | Implemented | `/.well-known/oauth-authorization-server`; advertises PKCE S256, CIMD support and DCR registration endpoint. |
| 401 starts sign-in with `WWW-Authenticate` | Implemented | Every unauthenticated MCP request returns 401 with `resource_metadata` and `scope`; no WWW-Authenticate on 200 responses. |
| Exact HTTPS redirect validation | Implemented | `redirectUriAllowed()` matches exact HTTPS URIs; `https://claude.ai/api/mcp/auth_callback` is accepted for any DCR/CIMD client that registers it. |
| Claude Code loopback redirect (port-agnostic) | Implemented | `localhost`/`127.0.0.1` loopback URIs match by path/query with port ignored. |
| PKCE S256 | Implemented | Authorization codes require 43-character S256 challenges; metadata advertises `["S256"]`. |
| Token issuance, expiry, rotation, revocation | Implemented | Short-lived access tokens, rotating refresh tokens with family revocation on replay, RFC 7009 revocation endpoint, hashed token storage. |
| Form-encoded token endpoint | Implemented / verify with live client | Token endpoint accepts `application/x-www-form-urlencoded` via Fastify parsing; DCR uses JSON. Confirm during Claude connector test. |
| CIMD and DCR | Implemented | Metadata advertises `client_id_metadata_document_supported: true` with `none` auth method, plus `registration_endpoint` for DCR fallback. |
| Tool descriptions and annotations | Implemented | All 26 tools have `title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`; injection test checks every listing. |
| Tool names ≤ 64 characters | Implemented | Names are short; registration throws if a future name exceeds 64 characters. |
| No catch-all tool / no mixed-method tool | Implemented | Discrete purpose-built tools; no generic HTTP request tool. |
| Input validation | Implemented | Zod schemas shared by MCP, REST and OpenAPI. |
| Prompt-injection-resistant descriptions | Implemented | Descriptions state what tools do; agent-behavior instructions were removed from tool metadata. Marketplace text is documented as user-supplied data. |
| No money movement tools | Implemented | No payment, payout, withdrawal or subscription tools exist. |
| Structured, safe errors | Implemented | `{success,message,error:{code}}`; no stack traces, SQL or secrets. |
| Concise responses | Implemented | Projected fields only; paginated lists, no full database dumps. |
| Graceful failure handling | Implemented locally | 400/401/403/404/409/429 tests; global error handler and generic 500 message in production. |
| Public documentation | Implemented | `/ai` technical docs with endpoint, OAuth flow, tools, scopes, prompts, errors, security, troubleshooting and support contact. |
| OpenAPI documentation | Implemented | `/openapi.json`, generated from shared schemas. |
| Public Privacy Policy and Terms of Service | Implemented | `/privacy` and `/terms` are public pages and now cover MCP access, third-party AI providers, consent, token security, revocation, AI-agent acceptable use. |
| Business contact information / support channel | Partially | `support@workora-phi.vercel.app` and `/contact` exist; add verified business details in the Anthropic developer portal manually. |
| Dedicated test account with realistic sample data | Pending manual | Must be created in the deployed environment and provided to Anthropic during Verified review. Do not use production user data. |
| Three working example prompts | Implemented | Five examples in `/ai`; validate them against the live connector manually. |
| Domain and API endpoints controlled by Workora | Pending manual | Confirm DNS ownership and that `/api/*`, `/.well-known/*` and `/openapi.json` are served from the canonical origin. |
| MCP Inspector end-to-end | Implemented locally | CLI `tools/list` against the running API returned 26 tools with schemas and annotations; OAuth browser flow not exercised. |
| Real Claude connector authentication flow | Not tested | No Claude account/access was provided. Must be tested as a custom connector before submission, per Anthropic docs. |
| Directory submission and approval | Not done | Submit at `claude.ai/directory/manage` after the manual items above. Workora makes no claim of verification, approval or endorsement. |

## Before submitting

1. Deploy to the canonical HTTPS origin; verify all discovery and MCP endpoints from an external network.
2. Add the connector as a custom connector in Claude and complete OAuth with a real Workora account.
3. Exercise every tool with the test account, including a two-step confirmation flow and a revoked-token retry.
4. Create the test account with realistic sample jobs/profiles and provide it only through Anthropic's review process.
5. Submit the MCP connector in the developer portal; answer the authentication questions as OAuth (DCR/CIMD).
