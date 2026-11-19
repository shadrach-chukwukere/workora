/**
 * Client-side API helper. Browser code calls this with relative paths
 * (e.g. "/api/v1/projects", "/api/auth/sign-in/email"). The Next.js rewrites
 * proxy them to the Fastify backend, so the session cookie is stored and sent
 * for the frontend domain. It never imports `next/headers` so it is safe
 * inside Client Components. Server Components must use @/lib/api-server.ts or
 * @/lib/api-data.ts, which forward cookies using the server-only API_URL.
 */

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: { code: string; details?: Record<string, unknown> };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Options = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Public GETs skip the session cookie entirely. */
  public?: boolean;
  /** Skip cache so SSR sees fresh data. */
  noStore?: boolean;
};

export async function api<T = unknown>(path: string, options: Options = {}): Promise<T> {
  const { method = "GET", body, headers: extraHeaders, public: isPublic = false, noStore = true } = options;

  const headers: Record<string, string> = { "content-type": "application/json", ...extraHeaders };

  const response = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "include",
    cache: noStore ? "no-store" : undefined,
  });

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    if (!response.ok) throw new ApiError(response.status, "UNEXPECTED", "Unexpected response from the server");
    return undefined as T;
  }

  if (!response.ok || !envelope?.success || envelope.data === undefined) {
    throw new ApiError(
      response.status,
      envelope?.error?.code ?? "REQUEST_FAILED",
      envelope?.message ?? "Request failed",
      envelope?.error?.details,
    );
  }
  return envelope.data;
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  account_type: "freelancer" | "client" | "admin";
  image?: string | null;
};

export type Session = { user: SessionUser } | null;
