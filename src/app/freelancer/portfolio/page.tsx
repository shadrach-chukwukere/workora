"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Field, Input, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-blocks";
import {
  Edit02Icon,
  ExternalLinkIcon,
  Icon,
  MoreVerticalIcon,
  PlusSignIcon,
  TrashIcon,
} from "@/lib/icons";

interface PortfolioItemDto {
  id: string;
  title: string;
  summary?: string | null;
  description: string | null;
  role: string | null;
  year: number | null;
  project_url: string | null;
  image_url: string | null;
}

interface PortfolioListResponse {
  items: PortfolioItemDto[];
}

interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  year: number | null;
  link: string | null;
  imageUrl: string | null;
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
  return envelope.data;
}

function fromDto(item: PortfolioItemDto): PortfolioItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description ?? "",
    tags: (item.role ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
    year: typeof item.year === "number" ? item.year : null,
    link: item.project_url ?? null,
    imageUrl: item.image_url ?? null,
  };
}

export default function FreelancerPortfolioPage() {
  const router = useRouter();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editor, setEditor] = useState<{ open: boolean; item: PortfolioItem | null }>({ open: false, item: null });
  const [deleteTarget, setDeleteTarget] = useState<PortfolioItem | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiClient<PortfolioListResponse>("/api/v1/users/me/portfolio");
      setItems((data.items ?? []).map(fromDto));
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AuthRequired") {
        router.push("/login");
        return;
      }
      setError(cause instanceof Error ? cause.message : "Could not load your portfolio");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const years = items.map((i) => i.year).filter((y): y is number => typeof y === "number");
  const yearRange = years.length > 0 ? `${Math.min(...years)} - ${Math.max(...years)}` : "n/a";
  const uniqueTags = useMemo(() => new Set(items.flatMap((i) => i.tags)).size, [items]);

  async function saveItem(input: { id?: string; title: string; description: string; tags: string[]; year: number; imageSeed: string; link?: string }) {
    if (saving) return;
    setSaving(true);
    const imageUrl = `https://picsum.photos/seed/workora-${input.imageSeed}/800/560`;
    const payload = {
      title: input.title,
      description: input.description,
      tags: input.tags,
      year: input.year,
      // Empty string clears the link server-side (COALESCE keeps old values on null).
      project_url: input.link ?? "",
      image_url: imageUrl,
    };
    try {
      if (input.id) {
        const existing = items.find((i) => i.id === input.id);
        const unchangedImage = existing ? seedOf(existing.imageUrl ?? "") === input.imageSeed : false;
        const withoutImage = { ...payload, image_url: undefined as string | undefined };
        await apiClient(`/api/v1/users/me/portfolio/${encodeURIComponent(input.id)}`, {
          method: "PATCH",
          body: JSON.stringify(unchangedImage ? withoutImage : payload),
        });
        toast.success("Portfolio item updated");
      } else {
        await apiClient("/api/v1/users/me/portfolio", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Portfolio item added");
      }
      await load();
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AuthRequired") {
        router.push("/login");
        return;
      }
      toast.error("Could not save the portfolio item", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await apiClient(`/api/v1/users/me/portfolio/${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
      toast.success(`Removed "${deleteTarget.title}" from your portfolio`);
      setDeleteTarget(null);
      await load();
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AuthRequired") {
        router.push("/login");
        return;
      }
      toast.error("Could not remove the portfolio item", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Portfolio"
        description="The work clients see before they invite you to a project. Keep it current."
        breadcrumbs={[{ label: "Freelancer", href: "/freelancer/dashboard" }, { label: "Portfolio" }]}
        actions={
          <Button size="md" onClick={() => setEditor({ open: true, item: null })}>
            <Icon icon={PlusSignIcon} size={15} strokeWidth={1.8} />
            Add to portfolio
          </Button>
        }
      />

      {error ? (
        <div className="card flex flex-wrap items-center justify-between gap-3 border border-rose-100 p-4" role="alert">
          <p className="text-sm text-rose-700">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => { setLoading(true); void load(); }}>
            Try again
          </Button>
        </div>
      ) : null}

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-[13px] font-medium text-neutral-500">Items</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-900">{items.length}</p>
          <p className="mt-1 text-xs text-neutral-500">Case studies on your public profile</p>
        </div>
        <div className="card p-5">
          <p className="text-[13px] font-medium text-neutral-500">Year range</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-900">{yearRange}</p>
          <p className="mt-1 text-xs text-neutral-500">First to most recent project</p>
        </div>
        <div className="card p-5">
          <p className="text-[13px] font-medium text-neutral-500">Unique tags</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-900">{uniqueTags}</p>
          <p className="mt-1 text-xs text-neutral-500">Skills clients can match you on</p>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="card px-6 py-12 text-center text-sm text-neutral-500">Loading your portfolio</div>
      ) : items.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="text-sm font-medium text-neutral-900">Your portfolio is empty</p>
          <p className="mt-1 text-sm text-neutral-500">Add your first case study so clients can see how you work.</p>
          <Button className="mt-4" size="md" onClick={() => setEditor({ open: true, item: null })}>
            <Icon icon={PlusSignIcon} size={15} strokeWidth={1.8} />
            Add to portfolio
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="card flex flex-col overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="aspect-[4/3] w-full rounded-t-xl object-cover"
                  loading="lazy"
                />
              ) : null}
              <div className="flex flex-1 flex-col gap-2 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug text-neutral-900">{item.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{item.year ?? "Year not set"}</p>
                  </div>
                  <DropdownMenu
                    label={`Options for ${item.title}`}
                    trigger={
                      <button
                        type="button"
                        aria-label={`Options for ${item.title}`}
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                      >
                        <Icon icon={MoreVerticalIcon} size={16} strokeWidth={1.8} />
                      </button>
                    }
                    items={[
                      { type: "item", label: "Edit item", icon: <Icon icon={Edit02Icon} size={15} strokeWidth={1.8} />, onClick: () => setEditor({ open: true, item }) },
                      { type: "item", label: "Remove from portfolio", icon: <Icon icon={TrashIcon} size={15} strokeWidth={1.8} />, danger: true, onClick: () => setDeleteTarget(item) },
                    ]}
                  />
                </div>
                <p className="line-clamp-2 text-xs leading-relaxed text-neutral-500">{item.description}</p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <Badge key={tag} tone="neutral">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  {item.link ? (
                    <Button href={item.link} external variant="ghost" size="sm" aria-label={`Open ${item.title} in a new tab`}>
                      <Icon icon={ExternalLinkIcon} size={14} strokeWidth={1.8} />
                      Visit
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <PortfolioEditor
        open={editor.open}
        item={editor.item}
        saving={saving}
        onClose={() => setEditor({ open: false, item: null })}
        onSave={saveItem}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Remove this item?"
        description={`"${deleteTarget?.title ?? ""}" will disappear from your public portfolio immediately. You can add it again later.`}
        confirmLabel={deleting ? "Removing" : "Remove item"}
        tone="danger"
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function seedOf(imageUrl: string): string {
  const match = imageUrl.match(/seed\/workora-(.+)\/800\/560/);
  return match?.[1] ?? "";
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "portfolio";
}

function PortfolioEditor({
  open,
  item,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  item: PortfolioItem | null;
  saving: boolean;
  onClose: () => void;
  onSave: (input: { id?: string; title: string; description: string; tags: string[]; year: number; imageSeed: string; link?: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [imageSeed, setImageSeed] = useState("");
  const [link, setLink] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Load the item being edited into local state when the modal opens.
  if (open && (item?.id ?? null) !== loadedId) {
    setLoadedId(item?.id ?? null);
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
    setTags(item?.tags.join(", ") ?? "");
    setYear(String(item?.year ?? new Date().getFullYear()));
    setImageSeed(item ? seedOf(item.imageUrl ?? "") : "");
    setLink(item?.link ?? "");
  } else if (!open && loadedId !== null) {
    setLoadedId(null);
  }

  const yearValue = Number(year);
  const yearValid = Number.isInteger(yearValue) && yearValue >= 2000 && yearValue <= new Date().getFullYear();
  const titleValid = title.trim().length >= 3;
  const tagsValid = tags.split(",").map((t) => t.trim()).filter(Boolean).length > 0;
  const canSave = titleValid && tagsValid && yearValid && description.trim().length >= 10 && !saving;

  function save() {
    if (!canSave) return;
    onSave({
      id: item?.id,
      title: title.trim(),
      description: description.trim(),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      year: yearValue,
      imageSeed: imageSeed.trim() || slugify(title),
      link: link.trim() || undefined,
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? "Edit portfolio item" : "Add to portfolio"}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" disabled={!canSave} onClick={save}>
            {item ? "Save changes" : "Add item"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Title" required>
          <Input id="portfolio-title" placeholder="Fleet operations console" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Description" required hint="At least 10 characters. One or two sentences is enough.">
          <Textarea id="portfolio-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tags" required hint="Comma separated">
            <Input id="portfolio-tags" placeholder="Next.js, PostgreSQL" value={tags} onChange={(e) => setTags(e.target.value)} />
          </Field>
          <Field label="Year" required error={year !== "" && !yearValid ? "Enter a real year, up to this year." : undefined}>
            <Input id="portfolio-year" type="number" min={2000} max={new Date().getFullYear()} value={year} onChange={(e) => setYear(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Image seed" hint="Cover image comes from picsum.photos, seeded by this value">
            <Input id="portfolio-seed" placeholder={slugify(title) || "fleet-console"} value={imageSeed} onChange={(e) => setImageSeed(e.target.value)} />
          </Field>
          <Field label="Link" hint="Optional, opens in a new tab">
            <Input id="portfolio-link" type="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
