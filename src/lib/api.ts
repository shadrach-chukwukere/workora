const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://workora-backend-x5il.onrender.com";

/**
 * Client-side API helper. Browser code calls this with relative paths
 * (the Next rewrites proxy them to Fastify on :3010). It never imports
 * `next/headers` so it is safe inside Client Components. Server Components
 * must use @/lib/api-server.ts or @/lib/api-data.ts, which forward cookies.
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

  const base = API_URL;
  const response = await fetch(base + path, {
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
