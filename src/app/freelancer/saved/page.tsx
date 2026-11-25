"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatDateShort, formatMoney } from "@/lib/format";
import { Icon, SaveIcon, Clock01Icon } from "@/lib/icons";

interface SavedProjectDto {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  budget_type: string | null;
  budget_min_minor: number | null;
  budget_max_minor: number | null;
  currency: string | null;
  status: string;
  created_at: string;
  proposals_count: number;
}

interface SavedProjectListResponse {
  projects: SavedProjectDto[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
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

export default function FreelancerSavedProjectsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["saved-projects", page],
    queryFn: async () => {
      const res = await apiClient<SavedProjectListResponse>(`/api/v1/users/me/saved-projects?page=${page}&perPage=9`);
      return res;
    },
    staleTime: 60_000,
  });

  const projects = data?.projects ?? [];
  const pagination = data ?? { page, perPage: 9, total: 0, totalPages: 1 };

  useEffect(() => {
    if (isError) {
      toast.error("Failed to load saved projects");
    }
  }, [isError]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-12">
        <span className="animation-spin rounded-full h-8 w-8 border-b border-brand-600"></span>
        <span className="ml-4 text-sm text-neutral-500">Loading saved projects…</span>
      </div>
    );
  }

  if (projects.length === 0 && page === 1) {
    return (
      <div className="py-12 text-center">
        <Icon icon={SaveIcon} size={48} className="mx-auto text-neutral-400 mb-4" />
        <p className="text-sm text-neutral-500">Save projects from the find-work page to view them here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Saved projects</h2>
        <nav aria-label="Saved projects pagination">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => {
          const budgetMin = project.budget_min_minor ? formatMoney(Number(project.budget_min_minor) / 100) : " negotiable ";
          const budgetMax = project.budget_max_minor ? ` - ${formatMoney(Number(project.budget_max_minor) / 100)}` : "";
          const priceCaption = budgetMin + budgetMax;
          const title = project.title;
          const summary = project.summary?.slice(0, 120) + ((project.summary?.length ?? 0) > 120 ? "…" : "");
          const year = project.created_at ? formatDateShort(new Date(project.created_at).toISOString().split("T")[0]) : "";

          return (
            <article
              key={project.id}
              className="card group hover:shadow-lg hover:border-brand-300 transition-shadow"
            >
              <Link
                href={`/freelancer/projects?apply=${project.id}`}
                className="group-hover:underline group/focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <h3 className="text-lg font-medium text-neutral-900 line-clamp-2">{title}</h3>
                <p className="mt-1 text-sm text-neutral-500 line-clamp-2">{summary}</p>
              </Link>
              <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
                <Icon icon={Clock01Icon} size={12} />
                <span>{year}</span>
              </div>
              <p className="mt-2 text-sm font-medium text-neutral-800">{priceCaption}</p>
            </article>
          );
        })}
      </div>

      <nav aria-label="Saved projects pagination" className="flex justify-between">
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