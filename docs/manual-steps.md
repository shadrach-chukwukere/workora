# Manual steps checklist (deployment and submissions)

Nothing here is automated by the code. Complete these after review in a staging environment.

## DNS / domains

- [ ] Point the public hostname (default in docs: `https://workora.com`) at the Vercel deployment; add the custom domain in Vercel.
- [ ] Confirm HTTPS works on the apex and `www` if both are used. The OAuth issuer and MCP resource URL must use the canonical origin consistently.

## Environment variables (placeholders only in `.env.example`)

Web (Vercel project settings):
- [ ] `API_URL` empty in production (browser fetches stay same-origin; Next rewrites them to Render).
- [ ] `NEXT_PUBLIC_SITE_URL` = canonical public origin.
- [ ] `WEB_APP_URL` = canonical public origin.

API (Render service settings):
- [ ] `WEB_APP_URL` = same canonical public origin.
- [ ] `MCP_ISSUER_URL` = same canonical public origin.
- [ ] `MCP_RESOURCE_URL` = `https://<canonical-origin>/api/mcp`.
- [ ] `MCP_ENABLED=true` (or `false` to disable the whole surface).
- [ ] `MCP_ACCESS_TOKEN_TTL_SECONDS` / `MCP_REFRESH_TOKEN_TTL_SECONDS` reviewed (defaults 3600 / 2592000).
- [ ] `AUTH_SECRET` strong, unique, stable across restarts (also signs confirmation tokens).
- [ ] `CORS_ORIGINS` includes the canonical web origin.
- [ ] Real database and payment/email/storage keys reviewed; no demo credentials in production.

## Platform configuration

- [ ] Run `npm run migrate` in `apps/api` once against the production database (migrations `0019_mcp_oauth` and `0020_agent_idempotency` are required).
- [ ] Verify the Next.js rewrites are present: `/api/mcp`, `/openapi.json`, `/.well-known/oauth-*`, `/api/oauth/*`, `/api/v1/*`, `/api/auth/*`, `/developers/mcp`.
- [ ] Confirm the host allows long-lived JSON POST responses for MCP (stateless JSON mode, no SSE required).
- [ ] Ensure the WAF/load balancer does not strip `Authorization` or `WWW-Authenticate` headers.
- [ ] Set up alerting on `429` rate limits and 5xx from `/api/mcp`.

## Verification before announcing

- [ ] `GET /robots.txt`, `/sitemap.xml`, `/openapi.json`, `/llms.txt`, `/ai` return 200 from the public origin.
- [ ] MCP Inspector connects to `https://<origin>/api/mcp`, lists tools, completes browser OAuth, and calls a public read and one confirmed write in staging.
- [ ] Revoke the test agent at `/settings/integrations` and confirm its next tool call gets `401`.
- [ ] Validate JobPosting / ProfilePage JSON-LD in Google Rich Results Test.
- [ ] Test ChatGPT and Claude connections separately with real accounts; record results in the final report. If access is unavailable, mark them untested.

## Directory / discovery submissions

- [ ] Submit the MCP server to the official MCP Registry (remote server entry pointing at `https://<origin>/api/mcp`) following the current registry quickstart.
- [ ] Add the site to Google Search Console and submit `/sitemap.xml`.
- [ ] Optionally list `/ai` and `/openapi.json` in developer directories; only claim client compatibility that has actually been tested.
- [ ] Keep `/llms.txt` updated when public routes change.
