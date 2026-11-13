"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { Tabs } from "@/components/ui/tabs";
import { Edit02Icon, Icon, MoreVerticalIcon, PlusSignIcon, Search01Icon, TrashIcon, CheckListIcon } from "@/lib/icons";
import { formatDateShort, formatMoney } from "@/lib/format";

export interface OwnProject {
  id: string;
  title: string;
  summary: string;
  status: "draft" | "open" | "in_progress" | "paused" | "completed" | "cancelled" | "flagged";
  budget_type: "fixed" | "hourly";
  budget_min_minor: string | number | null;
  budget_max_minor: string | number | null;
  currency: string;
  experience_level: "entry" | "intermediate" | "expert" | null;
  duration_bucket: "lt-1m" | "1-3m" | "3-6m" | "gt-6m" | null;
  proposals_count: number;
  published_at: string | null;
  deadline: string | null;
  created_at: string;
  category_name: string | null;
}

type OwnProjectStatus = OwnProject["status"];

const PROJECT_STATUS_META: Record<OwnProjectStatus, { label: string; tone: "neutral" | "brand" | "success" | "warning" | "danger" | "outline" }> = {
  draft: { label: "Draft", tone: "neutral" },
  open: { label: "Open", tone: "brand" },
  in_progress: { label: "In progress", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
  flagged: { label: "Flagged", tone: "warning" },
};

interface ProjectDetailResponse {
  project?: {
    id: string;
    title: string;
    summary: string;
    description: string;
    categoryId: string | null;
    budgetType: "fixed" | "hourly";
    budgetMinMinor: number | null;
    budgetMaxMinor: number | null;
    experienceLevel: "entry" | "intermediate" | "expert" | null;
    durationBucket: "lt-1m" | "1-3m" | "3-6m" | "gt-6m" | null;
    deadline: string | null;
  };
}

interface Envelope {
  success?: boolean;
  message?: string;
}

export function ProjectsClient({ projects, lifetimeSpendMinor }: { projects: OwnProject[]; lifetimeSpendMinor: number }) {
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "completed" | "all">("active");
  const [query, setQuery] = useState("");
  const [editTarget, setEditTarget] = useState<OwnProject | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDetail, setEditDetail] = useState<ProjectDetailResponse["project"] | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closeTarget, setCloseTarget] = useState<OwnProject | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      open: projects.filter((p) => p.status === "open").length,
      inProgress: projects.filter((p) => p.status === "in_progress").length,
      completed: projects.filter((p) => p.status === "completed" || p.status === "cancelled").length,
      active: projects.filter((p) => p.status === "open" || p.status === "in_progress" || p.status === "draft" || p.status === "paused").length,
    }),
    [projects],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base =
      tab === "active"
        ? projects.filter((p) => p.status === "open" || p.status === "in_progress" || p.status === "draft" || p.status === "paused")
        : tab === "completed"
          ? projects.filter((p) => p.status === "completed" || p.status === "cancelled")
          : projects;
    if (!q) return base;
    return base.filter((p) => p.title.toLowerCase().includes(q) || (p.category_name ?? "").toLowerCase().includes(q));
  }, [projects, tab, query]);

  async function apiPost(path: string, body?: Record<string, unknown>): Promise<{ ok: boolean; message?: string }> {
    const res = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 || res.status === 403) {
      router.push("/login");
      return { ok: false };
    }
    const envelope = (await res.json().catch(() => null)) as Envelope | null;
    return { ok: res.ok && Boolean(envelope?.success), message: envelope?.message };
  }

  async function publishProject(project: OwnProject) {
    if (actionPending) return;
    setActionPending(project.id);
    try {
      const result = await apiPost(`/api/v1/projects/${encodeURIComponent(project.id)}/publish`);
      if (result.ok) {
        toast.success("Listing published. It is visible to freelancers now.");
        router.refresh();
      } else {
        toast.error("Could not publish", { description: result.message ?? "Only drafts can be published." });
      }
    } catch {
      toast.error("Could not publish", { description: "Network error. Please try again." });
    } finally {
      setActionPending(null);
    }
  }

  async function confirmClose() {
    if (!closeTarget) return;
    setActionPending(closeTarget.id);
    try {
      const result = await apiPost(`/api/v1/projects/${encodeURIComponent(closeTarget.id)}/close`, {});
      if (result.ok) {
        toast.success(`"${closeTarget.title}" closed. It no longer accepts proposals.`);
        setCloseTarget(null);
        router.refresh();
      } else {
        toast.error("Could not close the listing", { description: result.message ?? "Only open listings can be closed." });
      }
    } catch {
      toast.error("Could not close the listing", { description: "Network error. Please try again." });
    } finally {
      setActionPending(null);
    }
  }

  function openEdit(project: OwnProject) {
    setEditTarget(project);
    setEditTitle(project.title);
    setEditSummary(project.summary);
    setEditDescription("");
    setEditDetail(null);
    setEditLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/v1/projects/${encodeURIComponent(project.id)}`, { credentials: "include" });
        const envelope = (await res.json().catch(() => null)) as { success?: boolean; data?: ProjectDetailResponse } | null;
        const detail = envelope?.data?.project ?? null;
        setEditDetail(detail);
        if (detail) {
          setEditTitle(detail.title);
          setEditSummary(detail.summary);
          setEditDescription(detail.description);
        }
      } catch {
        toast.error("Could not load the brief", { description: "Network error while fetching the project." });
      } finally {
        setEditLoading(false);
      }
    })();
  }

  async function saveEdit() {
    if (!editTarget || saving) return;
    const title = editTitle.trim();
    const summary = editSummary.trim();
    const description = editDescription.trim();
    if (title.length < 8) {
      toast.error("Give the brief a title of at least 8 characters.");
      return;
    }
    if (!summary) {
      toast.error("Add a one-line summary.");
      return;
    }
    if (!description) {
      toast.error("Describe the work before saving.");
      return;
    }
    setSaving(true);
    try {
      const detail = editDetail;
      const body: Record<string, unknown> = {
        title,
        summary,
        description,
        budgetType: detail?.budgetType ?? editTarget.budget_type,
      };
      if (detail?.categoryId) body.categoryId = detail.categoryId;
      const min = detail?.budgetMinMinor ?? (editTarget.budget_min_minor !== null ? Number(editTarget.budget_min_minor) : null);
      const max = detail?.budgetMaxMinor ?? (editTarget.budget_max_minor !== null ? Number(editTarget.budget_max_minor) : null);
      if (min !== null && min !== undefined) body.budgetMinMinor = Math.round(Number(min));
      if (max !== null && max !== undefined) body.budgetMaxMinor = Math.round(Number(max));
      const exp = detail?.experienceLevel ?? editTarget.experience_level;
      if (exp) body.experienceLevel = exp;
      const dur = detail?.durationBucket ?? editTarget.duration_bucket;
      if (dur) body.durationBucket = dur;
      const deadline = (detail?.deadline ?? editTarget.deadline ?? "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(deadline)) body.deadline = deadline;

      const res = await fetch(`/api/v1/projects/${encodeURIComponent(editTarget.id)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      const envelope = (await res.json().catch(() => null)) as Envelope | null;
      if (!res.ok || !envelope?.success) {
        toast.error("Could not save the brief", { description: envelope?.message ?? "Only drafts and open listings can be edited." });
        return;
      }
      setEditTarget(null);
      toast.success("Brief saved");
      router.refresh();
    } catch {
      toast.error("Could not save the brief", { description: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Your listings"
        description="Everything you have posted to the marketplace, open work first."
        actions={
          <Button href="/client/post-project" size="md">
            <Icon icon={PlusSignIcon} size={15} strokeWidth={2} />
            Post a project
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total projects" value={String(projects.length)} hint="Every listing you have created" />
        <StatCard label="Open listings" value={String(counts.open)} hint="Accepting proposals now" />
        <StatCard label="In progress" value={String(counts.inProgress)} hint="Contracts live on these briefs" />
        <StatCard label="Completed" value={String(counts.completed)} hint="Delivered or closed by you" />
        <StatCard label="Lifetime spend" value={formatMoney(lifetimeSpendMinor / 100)} hint="Across all your contracts" />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          ariaLabel="Filter listings"
          value={tab}
          onChange={(id) => setTab(id as typeof tab)}
          items={[
            { id: "active", label: "Active", count: counts.active },
            { id: "completed", label: "Completed", count: counts.completed },
            { id: "all", label: "All", count: projects.length },
          ]}
        />
        <div className="relative lg:w-72">
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            <Icon icon={Search01Icon} size={16} strokeWidth={1.8} />
          </span>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search listings by title"
            aria-label="Search listings"
            className="pl-9"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description={query.trim() ? "No listings match that search." : tab === "completed" ? "Closed listings land here once they are finished." : "Post your first brief and start receiving proposals."}
          action={
            <Button href="/client/post-project" size="md">
              <Icon icon={PlusSignIcon} size={15} strokeWidth={2} />
              Post a project
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((project) => {
            const editable = project.status === "draft" || project.status === "open";
            const min = project.budget_min_minor !== null ? Number(project.budget_min_minor) : null;
            const max = project.budget_max_minor !== null ? Number(project.budget_max_minor) : null;
            return (
              <li key={project.id} className="rounded-xl border border-neutral-200 bg-white p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={project.status} meta={PROJECT_STATUS_META} />
                      {project.category_name ? <Badge tone="outline">{project.category_name}</Badge> : null}
                      <span className="text-xs text-neutral-400">
                        {project.published_at ? `Published ${formatDateShort(project.published_at)}` : `Created ${formatDateShort(project.created_at)}`}
                        {project.deadline ? ` · due ${formatDateShort(project.deadline)}` : ""}
                      </span>
                    </div>
                    <Link href={`/project/${project.id}`} className="mt-1.5 block text-[15px] font-semibold leading-snug text-neutral-900 hover:text-brand-800">
                      {project.title}
                    </Link>
                    {project.summary ? <p className="mt-1 line-clamp-2 text-[13px] text-neutral-500">{project.summary}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-start gap-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-neutral-900">
                        {project.budget_type === "fixed"
                          ? min !== null
                            ? formatMoney(min / 100)
                            : "-"
                          : min !== null && max !== null
                            ? `${formatMoney(min / 100)} to ${formatMoney(max / 100)}`
                            : "-"}
                      </p>
                      <p className="text-[11px] text-neutral-400">{project.budget_type === "hourly" ? "per hour" : "fixed price"}</p>
                      <Link href={`/client/proposals?projectId=${project.id}`} className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
                        {project.proposals_count} proposals
                        <span aria-hidden>→</span>
                      </Link>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {project.status === "draft" ? (
                        <Button size="sm" onClick={() => publishProject(project)} loading={actionPending === project.id} disabled={actionPending !== null}>
                          <Icon icon={CheckListIcon} size={14} strokeWidth={1.8} />
                          Publish
                        </Button>
                      ) : null}
                      {project.status === "open" ? (
                        <Button variant="secondary" size="sm" onClick={() => setCloseTarget(project)} disabled={actionPending !== null}>
                          <Icon icon={TrashIcon} size={14} strokeWidth={1.8} />
                          Close
                        </Button>
                      ) : null}
                      <DropdownMenu
                        label={`Actions for ${project.title}`}
                        trigger={
                          <span
                            aria-hidden
                            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 transition-colors hover:bg-neutral-50"
                          >
                            <Icon icon={MoreVerticalIcon} size={16} strokeWidth={1.8} />
                          </span>
                        }
                        items={[
                          { label: "Edit brief", icon: <Icon icon={Edit02Icon} size={16} strokeWidth={1.8} />, disabled: !editable, onClick: () => openEdit(project) },
                          ...(project.status === "draft"
                            ? [{ label: "Publish project", icon: <Icon icon={CheckListIcon} size={16} strokeWidth={1.8} />, onClick: () => publishProject(project) }]
                            : []),
                          ...(project.status === "open"
                            ? [
                                {
                                  label: "Close project",
                                  icon: <Icon icon={TrashIcon} size={16} strokeWidth={1.8} />,
                                  danger: true,
                                  onClick: () => setCloseTarget(project),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Edit brief"
        description="Drafts and open listings can be edited. Changes apply to the live listing immediately."
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button size="md" onClick={saveEdit} loading={saving} disabled={editLoading}>
              Save brief
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Title" required>
            <Input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} disabled={editLoading} />
          </Field>
          <Field label="Summary" required>
            <Input value={editSummary} onChange={(event) => setEditSummary(event.target.value)} disabled={editLoading} />
          </Field>
          <Field label="Description" required hint={editLoading ? "Loading the current brief…" : undefined}>
            <Textarea rows={6} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} disabled={editLoading} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={closeTarget !== null}
        onClose={() => setCloseTarget(null)}
        title="Close this project?"
        description="The listing stops accepting proposals and moves to your completed tab. Contracts already in flight are not affected."
        confirmLabel="Close project"
        tone="danger"
        loading={actionPending === closeTarget?.id}
        onConfirm={confirmClose}
      />

      <p className="text-xs text-neutral-400">
        <Badge tone="outline">Tip</Badge> Closing a listing does not refund escrow on contracts born from it. Approve milestones from{" "}
        <Link href="/client/contracts" className="font-medium text-brand-700 hover:text-brand-800">Contracts</Link>.
      </p>
    </div>
  );
}
