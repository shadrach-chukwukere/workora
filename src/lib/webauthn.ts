"use client";

import { WebAuthManager } from "@chispecial/web_auth";

/** The package's README says WebAuthnManager, but the shipped export is WebAuthManager. */
const manager = new WebAuthManager("Workora", 60_000);

export interface SerializedCredential {
  id: string;
  rawId: string;
  type: "public-key";
  response: {
    clientDataJSON: string;
    attestationObject?: string;
    authenticatorData?: string;
    signature?: string;
    userHandle?: string | null;
    transports?: string[];
  };
  clientExtensionResults?: Record<string, unknown>;
  authenticatorAttachment?: string;
}

export interface PasskeyEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

function toBase64Url(buffer: ArrayBuffer | ArrayBufferView): string {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  return WebAuthManager.uint8ArrayToBase64(bytes);
}

/** Convert a browser credential into the JSON shape our API validates. */
export function serializeCredential(credential: PublicKeyCredential): SerializedCredential {
  const response = credential.response as AuthenticatorResponse & {
    attestationObject?: ArrayBuffer;
    authenticatorData?: ArrayBuffer;
    signature?: ArrayBuffer;
    userHandle?: ArrayBuffer | null;
    getTransports?: () => string[];
  };

  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: "public-key",
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      ...(response.attestationObject ? { attestationObject: toBase64Url(response.attestationObject) } : {}),
      ...(response.authenticatorData ? { authenticatorData: toBase64Url(response.authenticatorData) } : {}),
      ...(response.signature ? { signature: toBase64Url(response.signature) } : {}),
      userHandle: response.userHandle ? toBase64Url(response.userHandle) : null,
      transports: response.getTransports?.() ?? undefined,
    },
    clientExtensionResults: credential.getClientExtensionResults() as Record<string, unknown>,
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
  };
}

export function isWebAuthnSupported(): boolean {
  return typeof window !== "undefined" && Boolean(window.PublicKeyCredential && navigator.credentials);
}

export async function postPasskey<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/v1/passkeys${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let envelope: PasskeyEnvelope<T> | null = null;
  try {
    envelope = (await res.json()) as PasskeyEnvelope<T>;
  } catch {
    envelope = null;
  }
  if (!res.ok || !envelope?.success) {
    throw new Error(envelope?.message ?? "Passkey request failed. Please try again.");
  }
  return envelope.data;
}

/** Create and register a new passkey for the signed-in user. */
export async function createPasskey(): Promise<void> {
  if (!isWebAuthnSupported()) {
    throw new Error("This browser or device does not support passkeys. Use HTTPS and a modern browser.");
  }
  const options = await postPasskey<{
    token: string;
    challengeStr: string;
    userId: string;
    username: string;
    displayName: string;
    excludeCredentials: Array<{ id: string }>;
  }>("/register/begin", {});

  let credential: PublicKeyCredential;
  try {
    credential = await manager.createCredential({
      challengeStr: options.challengeStr,
      userId: options.userId,
      username: options.username,
      displayName: options.displayName,
      excludeCredentials: options.excludeCredentials.map((item) => item.id),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      throw new Error("Passkey setup was cancelled.");
    }
    throw new Error("Your device could not create a passkey. Try again or use a different authenticator.");
  }

  await postPasskey("/register/finish", {
    token: options.token,
    credential: serializeCredential(credential),
  });
}

/** Prompt for an existing passkey and sign in. */
export async function signInWithPasskey(email: string): Promise<void> {
  if (!isWebAuthnSupported()) {
    throw new Error("This browser or device does not support passkeys. Use HTTPS and a modern browser.");
  }
  const options = await postPasskey<{
    token: string;
    challengeStr: string;
    allowCredentials: Array<{ id: string }>;
  }>("/authenticate/begin", { email });

  if (options.allowCredentials.length === 0) {
    throw new Error("No passkey is registered for this email. Add one from your account settings.");
  }

  let credential: PublicKeyCredential;
  try {
    credential = await manager.getCredential({
      challengeStr: options.challengeStr,
      allowCredentials: options.allowCredentials,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      throw new Error("Passkey sign-in was cancelled.");
    }
    throw new Error("Your device could not verify that passkey. Try again.");
  }

  await postPasskey("/authenticate/finish", {
    token: options.token,
    credential: serializeCredential(credential),
  });
}
