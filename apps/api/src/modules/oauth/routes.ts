import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { mcpIssuer, mcpResourceUrl } from "../../config/env.js";
import { requireAuth } from "../common/index.js";
import {
  OAuthError,
  authorizationServerMetadata,
  createAuthorizationCode,
  exchangeCode,
  listConnections,
  protectedResourceMetadata,
  refreshTokens,
  registerClient,
  resolveClient,
  revokeConnection,
  revokeToken,
} from "./service.js";
import { parseScopes } from "./scopes.js";

const authorizeSchema = z.object({
  client_id: z.string().min(1).max(2048),
  redirect_uri: z.string().min(1).max(2048),
  response_type: z.literal("code"),
  scope: z.string().min(1),
  state: z.string().min(1).max(512),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code_challenge_method: z.literal("S256"),
  resource: z.string().url().optional(),
  approved: z.boolean(),
});

function sendOAuthError(reply: FastifyReply, error: unknown): void {
  if (error instanceof OAuthError) {
    reply.code(error.status).send({ error: error.code, error_description: error.message });
    return;
  }
  reply.code(500).send({ error: "server_error", error_description: "Authorization server error" });
}

function noStore(reply: FastifyReply): void {
  reply.header("Cache-Control", "no-store");
  reply.header("Pragma", "no-cache");
}

export default async function oauthRoutes(app: FastifyInstance) {
  /** RFC 8414 authorization server metadata. */
  app.get("/oauth/metadata", async (_request, reply) => {
    noStore(reply);
    reply.send(authorizationServerMetadata());
  });

  /** RFC 9728 protected resource metadata. */
  app.get("/oauth/protected-resource", async (_request, reply) => {
    noStore(reply);
    reply.send(protectedResourceMetadata());
  });

  /** Consent submission from the Workora-hosted authorization page. */
  app.post("/oauth/authorize", { preHandler: requireAuth }, async (request, reply) => {
    noStore(reply);
    try {
      const user = request.currentUser;
      if (!user) throw new OAuthError("invalid_request", "Authentication required", 401);
      const body = authorizeSchema.parse(request.body);
      const client = await resolveClient(body.client_id, true);
      if (!client) throw new OAuthError("invalid_client", "Unknown or invalid client", 401);
      if (!client.redirect_uris.includes(body.redirect_uri)) {
        throw new OAuthError("invalid_request", "redirect_uri is not registered for this client");
      }

      const target = new URL(body.redirect_uri);
      if (!body.approved) {
        target.searchParams.set("error", "access_denied");
        target.searchParams.set("state", body.state);
        target.searchParams.set("iss", mcpIssuer);
        reply.send({ redirectUrl: target.toString() });
        return;
      }

      const scopes = parseScopes(body.scope);
      if (scopes.length === 0) throw new OAuthError("invalid_scope", "At least one valid scope is required");
      const code = await createAuthorizationCode({
        userId: user.id,
        client,
        redirectUri: body.redirect_uri,
        scopes,
        codeChallenge: body.code_challenge,
        resource: body.resource ?? mcpResourceUrl,
      });
      target.searchParams.set("code", code);
      target.searchParams.set("state", body.state);
      target.searchParams.set("iss", mcpIssuer);
      reply.send({ redirectUrl: target.toString() });
    } catch (error) {
      sendOAuthError(reply, error);
    }
  });

  /** OAuth 2.1 token endpoint — public clients with PKCE only. */
  app.post("/oauth/token", async (request, reply) => {
    noStore(reply);
    try {
      const body = request.body as Record<string, string | undefined>;
      const grantType = body.grant_type;
      let result;
      if (grantType === "authorization_code") {
        result = await exchangeCode({
          code: body.code ?? "",
          codeVerifier: body.code_verifier ?? "",
          clientId: body.client_id ?? "",
          redirectUri: body.redirect_uri ?? "",
          resource: body.resource ?? "",
        });
      } else if (grantType === "refresh_token") {
        result = await refreshTokens({
          refreshToken: body.refresh_token ?? "",
          clientId: body.client_id ?? "",
          resource: body.resource ?? "",
        });
      } else {
        throw new OAuthError("unsupported_grant_type", "Only authorization_code and refresh_token are supported");
      }
      reply.send(result);
    } catch (error) {
      sendOAuthError(reply, error);
    }
  });

  /** RFC 7009 token revocation. Session owners or the public client may revoke. */
  app.post("/oauth/revoke", async (request, reply) => {
    noStore(reply);
    try {
      const body = request.body as Record<string, string | undefined>;
      const token = body.token ?? "";
      const revoked = await revokeToken({
        token,
        userId: request.currentUser?.id,
        clientId: body.client_id,
      });
      reply.send({ revoked });
    } catch (error) {
      sendOAuthError(reply, error);
    }
  });

  /** RFC 7591 dynamic client registration (public clients, loopback/https redirects). */
  app.post("/oauth/register", async (request, reply) => {
    noStore(reply);
    try {
      const client = await registerClient(request.body as Record<string, unknown>);
      reply.code(201).send({
        client_id: client.client_id,
        client_name: client.client_name,
        redirect_uris: client.redirect_uris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        application_type: client.application_type,
        client_id_issued_at: Math.floor(Date.now() / 1000),
      });
    } catch (error) {
      sendOAuthError(reply, error);
    }
  });

  /** Dashboard: list connections belonging to the signed-in user only. */
  app.get("/oauth/connections", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.currentUser;
    if (!user) return;
    noStore(reply);
    reply.send({ success: true, data: { connections: await listConnections(user.id) } });
  });

  /** Dashboard: revoke one connection (and every token issued to it). */
  app.delete("/oauth/connections/:id", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.currentUser;
    if (!user) return;
    const id = (request.params as { id: string }).id;
    if (!z.uuid().safeParse(id).success) {
      reply.code(400).send({ success: false, message: "Invalid connection id" });
      return;
    }
    const revoked = await revokeConnection(user.id, id);
    reply.code(revoked ? 200 : 404).send({ success: revoked, message: revoked ? "Connection revoked" : "Connection not found" });
  });
}
