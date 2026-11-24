"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-blocks";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminAccessCard, classifyAdminError } from "@/components/admin/admin-access";
import { formatNumber } from "@/lib/format";
import {
  Alert02Icon,
  Edit02Icon,
  Icon,
  InformationCircleIcon,
  PlusSignIcon,
  Tag01Icon,
  TrashIcon,
} from "@/lib/icons";
import { api } from "@/lib/api";

interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: string;
  sort_order: number | string;
  is_launch_focus: boolean;
  launch_rank: number | string;
  projects_count: number | string;
  skills_count: number | string;
}

const n = (v: number | string | null | undefined): number => {
  const parsed = Number(v ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default function AdminCategoriesPage() {
  const router = useRouter();
  const [items, setItems] = useState<AdminCategory[] | null>(null);
  const [forbidden, setForbidden] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ mode: "create" | "edit"; category?: AdminCategory } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ categories: AdminCategory[] }>("/api/v1/admin/categories");
      setItems(data.categories);
      setError(null);
    } catch (err) {
      const classified = classifyAdminError(err);
      if (classified.kind === "login") router.replace("/login");
      else if (classified.kind === "forbidden") setForbidden(classified.message);
      else setError(classified.message);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleLaunchFocus(category: AdminCategory) {
    setBusyId(category.id);
    try {
      await api(`/api/v1/admin/categories/${encodeURIComponent(category.id)}`, {
        method: "PATCH",
        body: { is_launch_focus: !category.is_launch_focus },
      });
      toast.success(category.is_launch_focus ? "Removed from launch focus" : "Added to launch focus");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update launch focus");
    } finally {
      setBusyId(null);
    }
  }

  async function removeCategory() {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await api(`/api/v1/admin/categories/${encodeURIComponent(deleting.id)}`, { method: "DELETE" });
      toast.success(`Removed ${deleting.name}`);
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove category");
    } finally {
      setBusyId(null);
    }
  }

  if (forbidden) return <AdminAccessCard message={forbidden} />;

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Categories"
          description="The catalog freelancers and clients navigate by."
          breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Categories" }]}
        />
        <EmptyState
          icon={<Icon icon={Alert02Icon} size={22} strokeWidth={1.8} />}
          title="Could not load categories"
          description={error}
          action={
            <Button variant="secondary" size="md" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Categories"
        description="Create, rename, reorder and curate the catalog. Changes go live in browse and posting immediately."
        breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Categories" }]}
        actions={
          <Button size="md" onClick={() => setEditor({ mode: "create" })}>
            <Icon icon={PlusSignIcon} size={15} strokeWidth={1.8} />
            New category
          </Button>
        }
      />

      {items === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-48 animate-pulse bg-neutral-50" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Icon icon={InformationCircleIcon} size={22} strokeWidth={1.8} />}
          title="No categories yet"
          description="Create the first category; it goes live in browse and posting flows immediately."
          action={
            <Button size="md" onClick={() => setEditor({ mode: "create" })}>
              <Icon icon={PlusSignIcon} size={15} strokeWidth={1.8} />
              New category
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => (
            <article key={c.id} className="card flex flex-col gap-4 p-5 transition-shadow hover:shadow-sm">
              <div className="flex items-start gap-3">
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon icon={Tag01Icon} size={18} strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold text-neutral-900">{c.name}</h2>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-neutral-400">{c.slug}</p>
                </div>
                <Badge tone={c.is_launch_focus ? "success" : "neutral"}>
                  {c.is_launch_focus ? `Launch · ${n(c.launch_rank)}` : "Not in launch"}
                </Badge>
              </div>

              <p className="line-clamp-3 min-h-[42px] text-[13px] leading-relaxed text-neutral-600">
                {c.description || "No description yet."}
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                <span>{formatNumber(n(c.projects_count))} projects</span>
                <span>{formatNumber(n(c.skills_count))} skills</span>
                <span>Sort {n(c.sort_order)}</span>
                <span className="capitalize">{c.kind}</span>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busyId === c.id}
                  onClick={() => void toggleLaunchFocus(c)}
                >
                  {c.is_launch_focus ? "Remove from launch" : "Add to launch"}
                </Button>
                <button
                  type="button"
                  aria-label={`Edit ${c.name}`}
                  onClick={() => setEditor({ mode: "edit", category: c })}
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                >
                  <Icon icon={Edit02Icon} size={16} strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${c.name}`}
                  onClick={() => setDeleting(c)}
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                >
                  <Icon icon={TrashIcon} size={16} strokeWidth={1.8} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="flex items-center gap-2 text-xs text-neutral-500">
        <Icon icon={InformationCircleIcon} size={14} strokeWidth={1.8} />
        Removing a category keeps its projects and clears their category; skill links are removed with it.
      </p>

      <CategoryEditor
        key={editor ? `${editor.mode}-${editor.category?.id ?? "new"}` : "closed"}
        editor={editor}
        onClose={() => setEditor(null)}
        onDone={() => {
          setEditor(null);
          void load();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void removeCategory()}
        title={`Remove ${deleting?.name ?? "category"}?`}
        description="Projects in this category stay published without a category. This cannot be undone."
        confirmLabel="Remove category"
        tone="danger"
        loading={busyId === deleting?.id}
      />
    </div>
  );
}

function CategoryEditor({
  editor,
  onClose,
  onDone,
}: {
  editor: { mode: "create" | "edit"; category?: AdminCategory } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const existing = editor?.category;
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [sortOrder, setSortOrder] = useState(existing ? String(n(existing.sort_order)) : "100");
  const [launchRank, setLaunchRank] = useState(existing ? String(n(existing.launch_rank)) : "100");
  const [launchFocus, setLaunchFocus] = useState(existing?.is_launch_focus ?? false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const mode = editor?.mode ?? "create";
  const nameValid = name.trim().length > 0;
  const derivedSlug = slugify(name);

  async function submit() {
    setTouched(true);
    if (!nameValid) return;
    setSaving(true);
    try {
      const sort = Number(sortOrder);
      const rank = Number(launchRank);
      const body = {
        name: name.trim(),
        description: description.trim(),
        sort_order: Number.isFinite(sort) ? sort : 100,
        is_launch_focus: launchFocus,
        launch_rank: Number.isFinite(rank) ? rank : 100,
      };
      if (mode === "create") {
        await api<{ id: string }>("/api/v1/admin/categories", {
          method: "POST",
          body: { ...body, slug: derivedSlug, kind: "category" },
        });
        toast.success("Category created");
      } else if (existing) {
        await api<{ id: string }>(`/api/v1/admin/categories/${encodeURIComponent(existing.id)}`, {
          method: "PATCH",
          body,
        });
        toast.success("Category saved");
      }
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={editor != null}
      onClose={onClose}
      title={mode === "create" ? "New category" : `Edit ${existing?.name ?? "category"}`}
      description={mode === "create" ? "Goes live as soon as it is created." : "Changes go live immediately."}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="md" onClick={() => void submit()} loading={saving}>
            {mode === "create" ? "Create category" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Name" required error={touched && !nameValid ? "Give the category a name." : undefined}>
          <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Web Development" />
        </Field>
        {mode === "create" ? (
          <Field label="Slug" hint="Derived from the name.">
            <Input id="category-slug" value={derivedSlug} readOnly className="bg-neutral-50 font-mono text-neutral-600" />
          </Field>
        ) : null}
        <Field label="Description">
          <Textarea id="category-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What falls under this category, in one or two sentences." />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sort order" hint="Lower sorts earlier in browse.">
            <Input id="category-sort" type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </Field>
          <Field label="Launch rank" hint="Lower ranks appear first in launch picks.">
            <Input id="category-rank" type="number" min={0} value={launchRank} onChange={(e) => setLaunchRank(e.target.value)} />
          </Field>
        </div>
        <Checkbox label="Show this category in launch picks" checked={launchFocus} onChange={(e) => setLaunchFocus(e.target.checked)} />
      </div>
    </Modal>
  );
}
