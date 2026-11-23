import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from "@simplewebauthn/server";
import { serializeSignedCookie } from "better-call";
import { sql, type SqlBool } from "kysely";
import { env } from "../../config/env.js";
import { db } from "../../database/connection.js";
import { auth } from "../auth/auth.js";
import type { CredentialJson } from "./schemas.js";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const CHALLENGE_PREFIX = "passkey:";
const SUPPORTED_ALGORITHMS = [-7, -257]; // ES256 + RS256: exactly what the browser library offers.

export interface PasskeySummary {
  id: string;
  credentialId: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
}

export interface RegistrationBeginResult {
  token: string;
  challengeStr: string;
  userId: string;
  username: string;
  displayName: string;
  excludeCredentials: Array<{ id: string }>;
}

export interface AuthenticationBeginResult {
  token: string;
  challengeStr: string;
  allowCredentials: Array<{ id: string }>;
}

/** WebAuthn binds credentials to the site origin, not the API origin. */
function webAuthnConfig() {
  const webOrigin = env.WEB_APP_URL.replace(/\/+$/, "");
  const rpID = new URL(webOrigin).hostname;
  const origins = [webOrigin];
  if (env.NODE_ENV !== "production") {
    origins.push("http://localhost:3000", "http://localhost:3010");
  }
  return { rpID, origins, rpName: "Workora" };
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

async function saveChallenge(identifier: string, challenge: string): Promise<void> {
  const database = await db();
  await sql`
    INSERT INTO verifications (id, identifier, value, expires_at, created_at, updated_at)
    VALUES (gen_random_uuid(), ${identifier}, ${challenge}, ${new Date(Date.now() + CHALLENGE_TTL_MS)}, now(), now())
  `.execute(database);
}

/** Atomically take a challenge. A token can only ever be used once. */
async function takeChallenge(identifier: string): Promise<string | null> {
  const database = await db();
  const rows = await sql<{ value: string }>`
    DELETE FROM verifications
    WHERE identifier = ${identifier} AND expires_at > now()
    RETURNING value
  `.execute(database);
  return rows.rows[0]?.value ?? null;
}

export async function listPasskeys(userId: string): Promise<PasskeySummary[]> {
  const database = await db();
  const rows = await database
    .selectFrom("passkeys")
    .select(["id", "credential_id", "device_type", "backed_up", "created_at"])
    .where("user_id", "=", userId)
    .orderBy("created_at", "desc")
    .execute();
  return rows.map((row) => ({
    id: row.id,
    credentialId: row.credential_id,
    deviceType: row.device_type,
    backedUp: row.backed_up,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));
}

export async function removePasskey(userId: string, passkeyId: string): Promise<boolean> {
  const database = await db();
  const result = await database
    .deleteFrom("passkeys")
    .where("id", "=", passkeyId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}

export async function beginRegistration(userId: string): Promise<RegistrationBeginResult> {
  const { rpID, rpName } = webAuthnConfig();
  const database = await db();
  const user = await database
    .selectFrom("users")
    .select(["id", "name", "email"])
    .where("id", "=", userId)
    .executeTakeFirst();
  if (!user) throw new Error("Account not found");

  const existing = await database
    .selectFrom("passkeys")
    .select("credential_id")
    .where("user_id", "=", user.id)
    .execute();

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    supportedAlgorithmIDs: SUPPORTED_ALGORITHMS,
    excludeCredentials: existing.map((row) => ({ id: row.credential_id, transports: ["internal", "hybrid"] })),
  });

  const token = crypto.randomUUID();
  await saveChallenge(`${CHALLENGE_PREFIX}register:${user.id}:${token}`, options.challenge);

  return {
    token,
    challengeStr: options.challenge,
    userId: toBase64Url(new TextEncoder().encode(user.id)),
    username: user.email,
    displayName: user.name,
    excludeCredentials: existing.map((row) => ({ id: row.credential_id })),
  };
}

export async function finishRegistration(
  user: { id: string },
  token: string,
  credential: CredentialJson,
): Promise<PasskeySummary> {
  const { rpID, origins } = webAuthnConfig();
  const response = credential.response as RegistrationResponseJSON["response"];
  if (!response.attestationObject) {
    throw new Error("Registration response is missing attestation data");
  }

  const payload: RegistrationResponseJSON = {
    id: credential.id,
    rawId: credential.rawId,
    type: "public-key",
    response: {
      clientDataJSON: response.clientDataJSON,
      attestationObject: response.attestationObject,
      transports: response.transports,
    },
    clientExtensionResults: credential.clientExtensionResults ?? {},
  };

  // Take (and therefore consume) the challenge we issued for this token. The
  // verifier compares it with the signed clientDataJSON challenge, so an
  // attacker-supplied challenge can never be substituted.
  const challenge = await takeChallenge(`${CHALLENGE_PREFIX}register:${user.id}:${token}`);
  if (!challenge) throw new Error("Registration challenge is invalid or has expired");

  const verification = await verifyRegistrationResponse({
    response: payload,
    expectedChallenge: challenge,
    expectedOrigin: origins,
    expectedRPID: rpID,
    requireUserPresence: true,
    requireUserVerification: false,
    supportedAlgorithmIDs: SUPPORTED_ALGORITHMS,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Passkey verification failed");
  }

  const credentialRecord = verification.registrationInfo.credential;
  const database = await db();
  const inserted = await database
    .insertInto("passkeys")
    .values({
      user_id: user.id,
      credential_id: credentialRecord.id,
      public_key: toBase64Url(credentialRecord.publicKey),
      counter: credentialRecord.counter,
      transports: payload.response.transports?.length ? payload.response.transports.join(",") : null,
      device_type: verification.registrationInfo.credentialDeviceType,
      backed_up: verification.registrationInfo.credentialBackedUp,
    })
    .onConflict((oc) => oc.column("credential_id").doNothing())
    .returning(["id", "created_at"])
    .executeTakeFirst();

  if (!inserted) throw new Error("This passkey is already registered");

  return {
    id: inserted.id,
    credentialId: credentialRecord.id,
    deviceType: verification.registrationInfo.credentialDeviceType,
    backedUp: verification.registrationInfo.credentialBackedUp,
    createdAt: inserted.created_at instanceof Date ? inserted.created_at.toISOString() : String(inserted.created_at),
  };
}

export async function beginAuthentication(email?: string): Promise<AuthenticationBeginResult> {
  const { rpID } = webAuthnConfig();
  const database = await db();
  let allowCredentials: Array<{ id: string; transports?: string[] }> = [];

  if (email) {
    const user = await database
      .selectFrom("users")
      .select("id")
      .where(sql<SqlBool>`lower(email) = ${email.trim().toLowerCase()}`)
      .executeTakeFirst();
    if (user) {
      const passkeys = await database
        .selectFrom("passkeys")
        .select(["credential_id", "transports"])
        .where("user_id", "=", user.id)
        .execute();
      allowCredentials = passkeys.map((row) => ({
        id: row.credential_id,
        transports: row.transports ? row.transports.split(",") : ["internal", "hybrid"],
      }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    userVerification: "preferred",
  });

  const token = crypto.randomUUID();
  await saveChallenge(`${CHALLENGE_PREFIX}auth:${token}`, options.challenge);

  return {
    token,
    challengeStr: options.challenge,
    allowCredentials: allowCredentials.map((item) => ({ id: item.id })),
  };
}

export interface AuthenticationResult {
  userId: string;
  cookie: string;
}

export async function finishAuthentication(
  token: string,
  credential: CredentialJson,
): Promise<AuthenticationResult> {
  const { rpID, origins } = webAuthnConfig();
  const response = credential.response as AuthenticationResponseJSON["response"];
  if (!response.authenticatorData || !response.signature) {
    throw new Error("Authentication response is missing assertion data");
  }

  const payload: AuthenticationResponseJSON = {
    id: credential.id,
    rawId: credential.rawId,
    type: "public-key",
    response: {
      clientDataJSON: response.clientDataJSON,
      authenticatorData: response.authenticatorData,
      signature: response.signature,
      userHandle: response.userHandle ?? undefined,
    },
    clientExtensionResults: credential.clientExtensionResults ?? {},
  };

  const challenge = await takeChallenge(`${CHALLENGE_PREFIX}auth:${token}`);
  if (!challenge) throw new Error("Passkey challenge is invalid or has expired");

  const database = await db();
  const stored = await database
    .selectFrom("passkeys")
    .selectAll()
    .where("credential_id", "=", credential.id)
    .executeTakeFirst();
  if (!stored) throw new Error("Passkey is not recognised");

  const credentialRecord: WebAuthnCredential = {
    id: stored.credential_id,
    publicKey: Buffer.from(stored.public_key, "base64url"),
    counter: Number(stored.counter),
    transports: stored.transports ? stored.transports.split(",") : undefined,
  };

  const verification = await verifyAuthenticationResponse({
    response: payload,
    expectedChallenge: challenge,
    expectedOrigin: origins,
    expectedRPID: rpID,
    credential: credentialRecord,
    requireUserVerification: false,
  });

  if (!verification.verified) throw new Error("Passkey verification failed");

  if (verification.authenticationInfo.newCounter > credentialRecord.counter) {
    await database
      .updateTable("passkeys")
      .set({
        counter: verification.authenticationInfo.newCounter,
        backed_up: verification.authenticationInfo.credentialBackedUp,
      })
      .where("id", "=", stored.id)
      .execute();
  }

  const ctx = (await auth.$context) as unknown as {
    secret: string;
    authCookies: { sessionToken: { name: string; attributes: Record<string, unknown> } };
    sessionConfig: { expiresIn: number };
    internalAdapter: { createSession: (userId: string) => Promise<{ token: string } | null> };
  };

  const session = await ctx.internalAdapter.createSession(stored.user_id);
  if (!session) throw new Error("Could not create a session");

  const cookie = await serializeSignedCookie(
    ctx.authCookies.sessionToken.name,
    session.token,
    ctx.secret,
    {
      ...ctx.authCookies.sessionToken.attributes,
      maxAge: ctx.sessionConfig.expiresIn,
    } as never,
  );

  return { userId: stored.user_id, cookie };
}
