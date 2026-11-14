import { cookies } from "next/headers";

/** Server-side call to the Fastify API, with cookies forwarded so auth'd reads work. */
const API = process.env.NEXT_PUBLIC_API_URL ?? "https://workora-backend-x5il.onrender.com";

export async function apiServer<T = unknown>(path: string, opts: { public?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (!opts.public) {
    try {
      const cookieStore = await cookies();
      const cookie = cookieStore
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");
      if (cookie) headers.cookie = cookie;
    } catch {
      // unauthenticated read
    }
  }
  const res = await fetch(API + path, { headers, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`apiServer ${path} -> ${res.status}: ${text.slice(0, 200)}`);
  }
  const envelope = (await res.json()) as { success: boolean; data?: T; message?: string };
  if (!envelope.success || envelope.data === undefined) {
    throw new Error(`apiServer ${path}: ${envelope.message ?? "bad envelope"}`);
  }
  return envelope.data;
}

export interface PublicProject {
  id: string;
  client_id: string;
  title: string;
  summary: string;
  description: string;
  category_id: string | null;
  status: "draft" | "open" | "in_progress" | "paused" | "completed" | "cancelled" | "flagged";
  budget_type: "fixed" | "hourly";
  budget_min_minor: number | null;
  budget_max_minor: number | null;
  currency: string;
  experience_level: "entry" | "intermediate" | "expert" | null;
  duration_bucket: "lt-1m" | "1-3m" | "3-6m" | "gt-6m" | null;
  proposals_count: number;
  invited_only: boolean;
  published_at: string | null;
  deadline: string | null;
  created_at: string;
}

export interface PublicFreelancer {
  id: string;
  name: string;
  image: string | null;
  headline: string;
  hourly_rate_minor: number | null;
  experience_level: "entry" | "intermediate" | "expert" | null;
  availability: "available" | "limited" | "unavailable";
  verified_identity: boolean;
  rating_avg: string | null;
  rating_count: number;
  completed_count: number;
  location: string | null;
}

export interface PublicPlan {
  id: string;
  code: string;
  name: string;
  audience: "freelancer" | "client";
  price_minor: number;
  currency: string;
  interval: "monthly" | "annual";
  features: string[];
  is_highlighted: boolean;
  is_active: boolean;
  sort_order: number;
}

/** Best-effort fetch: returns fallback instead of throwing so public pages still work offline. */
export async function apiServerOr<T>(path: string, fallback: T, publicCall = true): Promise<T> {
  try {
    return await apiServer<T>(path, { public: publicCall });
  } catch {
    return fallback;
  }
}
