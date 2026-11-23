import { z } from "zod";

/** Browser-serialised PublicKeyCredential (ArrayBuffers encoded as base64url). */
const credentialResponseSchema = z.object({
  clientDataJSON: z.string().min(1),
  attestationObject: z.string().min(1).optional(),
  authenticatorData: z.string().min(1).optional(),
  signature: z.string().min(1).optional(),
  userHandle: z.string().nullable().optional(),
  transports: z.array(z.string()).optional(),
});

export const credentialJsonSchema = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  type: z.literal("public-key"),
  response: credentialResponseSchema,
  clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
  authenticatorAttachment: z.string().optional(),
});

export const registerBeginSchema = z.object({}).default({});

export const registerFinishSchema = z.object({
  token: z.string().uuid("Invalid registration token"),
  credential: credentialJsonSchema,
});

export const authenticateBeginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(320).optional(),
});

export const authenticateFinishSchema = z.object({
  token: z.string().uuid("Invalid authentication token"),
  credential: credentialJsonSchema,
});

export const passkeyIdParamSchema = z.object({
  id: z.string().uuid("Invalid passkey id"),
});

export type CredentialJson = z.infer<typeof credentialJsonSchema>;
