"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/format";
import { Icon, Mail01Icon } from "@/lib/icons";
import { serverApiBase } from "@/lib/api-base";

interface ProjectInvitation {
  id: string;
  project_id: string;
  client_id: string;
  freelancer_id: string;
  message: string;
  status: "pending" | "accepted" | "declined" | "withdrawn";
  created_at: string;
  project_title: string;
  client_name: string;
  client_image: string | null;
}

interface InvitationsResponse {
  invitations: ProjectInvitation[];
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

export default function FreelancerInvitationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["freelancer-invitations", page],
    queryFn: async () => {
      const res = await apiClient<InvitationsResponse>(`/api/v1/users/me/invitations?page=${page}&perPage=9`);
      return res;
    },
    staleTime: 60_000,
  });

  const invitations = data?.invitations ?? [];
  const pagination = data
    ? { page: data.page, perPage: data.perPage, total: data.total, totalPages: data.totalPages }
    : { page, perPage: 9, total: 0, totalPages: 1 };

  useEffect(() => {
    if (isError) {
      toast.error("Failed to load invitations");
    }
  }, [isError]);

  const handleAccept = async (invitationId: string) => {
    try {
      const res = await fetch(`${serverApiBase}/api/v1/invitations/${invitationId}/accept`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Invitation accepted");
        router.refresh();
      } else {
        toast.error(data.message ?? "Failed to accept invitation");
      }
    } catch (e) {
      toast.error("Failed to accept invitation");
    }
  };

  const handleDecline = async (invitationId: string) => {
    try {
      const res = await fetch(`${serverApiBase}/api/v1/invitations/${invitationId}/decline`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Invitation declined");
        router.refresh();
      } else {
        toast.error(data.message ?? "Failed to decline invitation");
      }
    } catch (e) {
      toast.error("Failed to decline invitation");
    }
  };

  const handleWithdraw = async (invitationId: string) => {
    try {
      const res = await fetch(`${serverApiBase}/api/v1/invitations/${invitationId}/withdraw`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Invitation withdrawn");
        router.refresh();
      } else {
        toast.error(data.message ?? "Failed to withdraw invitation");
      }
    } catch (e) {
      toast.error("Failed to withdraw invitation");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-12">
        <span className="animation-spin rounded-full h-8 w-8 border-b border-brand-600"></span>
        <span className="ml-4 text-sm text-neutral-500">Loading invitations…</span>
      </div>
    );
  }

  if (invitations.length === 0 && page === 1) {
    return (
      <div className="py-12 text-center">
        <Icon icon={Mail01Icon} size={48} className="mx-auto text-neutral-400 mb-4" />
        <p className="text-sm text-neutral-500">No pending invitations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Invitations</h2>
        <span className="text-sm text-neutral-500">
          {invitations.length} {invitations.length === 1 ? "invitation" : "invitations"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {invitations.map((inv) => {
          const clientImage = inv.client_image ?? `https://i.pravatar.cc/150?u=${inv.client_id}`;
          const statusBadge = inv.status === "pending" ? (
            <Badge tone="neutral">Pending</Badge>
          ) : inv.status === "accepted" ? (
            <Badge tone="success">Accepted</Badge>
          ) : inv.status === "declined" ? (
            <Badge tone="danger">Declined</Badge>
          ) : (
            <Badge tone="warning">Withdrawn</Badge>
          );

          return (
            <article
              key={inv.id}
              className="card p-4 border-l-4 border-brand-600 group-hover:border-brand-300 transition-colors"
            >
              <div className="flex items-start gap-3">
                <Avatar src={clientImage} name={inv.client_name} size="sm" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-neutral-900">{inv.client_name}</p>
                  <p className="text-[10px] text-neutral-500">{inv.project_title}</p>
                  <p className="mt-1 text-[10px] text-neutral-400">{inv.message ?? "No message"}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
                <span>{formatDateShort(inv.created_at)}</span>
                {inv.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAccept(inv.id)}
                      className="text-brand-600 hover:text-brand-800"
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDecline(inv.id)}
                      className="text-rose-600 hover:text-rose-700"
                    >
                      Decline
                    </Button>
                  </>
                )}
                {inv.status === "pending" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleWithdraw(inv.id)}
                    className="text-neutral-500 hover:text-neutral-700"
                  >
                    Withdraw
                  </Button>
                )}
                {inv.status !== "pending" && !inviteStatuses[inv.status] && (
                  <span>{inviteStatuses[inv.status]?.label ?? inv.status}</span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <nav aria-label="Invitations pagination" className="flex justify-between">
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

const inviteStatuses: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  pending: { label: "Pending", tone: "neutral" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
  withdrawn: { label: "Withdrawn", tone: "warning" },
};