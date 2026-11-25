"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatMoney, formatRelative } from "@/lib/format";
import { Icon, ChecklistIcon, HeartIcon } from "@/lib/icons";

interface ShortlistedTalent {
  id: string;
  name: string;
  headline: string | null;
  location: string | null;
  hourly_rate_minor: number | null;
  availability: string;
  rating_avg: number | null;
  rating_count: number;
  completed_count: number;
  verified_identity: boolean;
  skills: string[];
  note: string | null;
  created_at: string;
}

interface ShortlistListResponse {
  talent: ShortlistedTalent[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const res = fetch(path, {
    ...init,
    credentials: "include",
    headers: init?.body !== undefined ? { "content-type": "application/json", ...init?.headers } : init?.headers,
  });
  if (res.status === 401) {
    const error = new Error("AUTH_REQUIRED");
    error.name = "AuthRequired";
    throw error;
  }
  let envelope: { success?: boolean; message?: string; data?: T } | null = null;
  try {
    envelope = (await res.json()) as { success?: boolean; message?: string; data?: T };
  } catch {
    envelope = null;
  }
  if (!res.ok || !envelope?.success || envelope.data === undefined) {
    throw new Error(envelope?.message ?? `Request to ${path} failed`);
  }
  return envelope.data as T;
}

export default function ClientShortlistPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["client-shortlist", page],
    queryFn: async () => {
      const res = await apiClient<ShortlistListResponse>(`/api/v1/users/me/shortlist?page=${page}&perPage=9`);
      return res;
    },
    staleTime: 60_000,
  });

  const talent = data?.talent ?? [];
  const pagination = data?.pagination ?? { page, perPage: 9, total: 0, totalPages: 1 };

  useEffect(() => {
    if (isError) {
      toast.error("Failed to load shortlist");
    }
  }, [isError]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-12">
        <span className="animation-spin rounded-full h-8 w-8 border-b border-brand-600"></span>
        <span className="ml-4 text-sm text-neutral-500">Loading shortlist…</span>
      </div>
    );
  }

  if (talent.length === 0 && page === 1) {
    return (
      <div className="py-12 text-center">
        <Icon icon={HeartIcon} size={48} className="mx-auto text-neutral-400 mb-4" />
        <p className="text-sm text-neutral-500">No talent on your shortlist yet. Browse talent and click the heart button to add them.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Shortlisted talent</h2>
        <span className="text-sm text-neutral-500">
          {talent.length} {talent.length === 1 ? "talent" : "talents"} shortlisted
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {talent.map((t) => {
          const rate = t.hourly_rate_minor != null ? `${formatMoney(Number(t.hourly_rate_minor) / 100)}/hr` : " negotiable ";
          const availability = t.availability === "available" ? "Open" : t.availability === "limited" ? "Limited" : "Booked";
          const tone = t.availability === "available" ? "brand" : t.availability === "limited" ? "warning" : "neutral";

          return (
            <article
              key={t.id}
              className="card group hover:shadow-lg hover:border-brand-300 transition-shadow"
            >
              <div className="p-4">
                <Avatar src={`https://i.pravatar.cc/150?u=${t.id}`} name={t.name} size="lg" alt="" className="mb-3" />
                <h3 className="text-lg font-medium text-neutral-900 line-clamp-2">{t.headline ?? "No headline"}</h3>
                <p className="mt-1 text-sm text-neutral-500 line-clamp-2">{t.location ?? ""}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
                  <Icon icon={MapPinIcon} size={12} />
                  <span>{t.location ?? "Location not specified"}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-neutral-800">{rate}</p>
                <Badge tone={tone}>{availability}</Badge>
                <p className="mt-2 text-xs text-neutral-500">Completed: {t.completed_count}</p>
                {t.rating_avg !== null && (
                  <p className="mt-1">
                    <Icon icon={StarIcon} size={12} strokeWidth={2} className="text-amber-500" />
                    {t.rating_avg.toFixed(1)} ({t.rating_count} reviews)
                  </p>
                )}
                <p className="mt-2 text-[10px] font-semibold text-neutral-500">Added: {formatRelative(t.created_at)}</p>
                <p className="mt-2 text-[10px] text-neutral-400">{t.note ?? "No note"}</p>
              </div>
            </article>
          );
        })}
      </div>

      <nav aria-label="Shortlist pagination" className="flex justify-between">
        <Button
          variant="link"
          size="sm"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          Previous
        </Button>
        <span className="mx-2 text-sm text-neutral-500">
          Page {page} of {pagination.totalPages}
        </span>
        <Button
          variant="link"
          size="sm"
          onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
          disabled={page >= pagination.totalPages}
        >
          Next
        </Button>
      </nav>
    </div>
  );
}