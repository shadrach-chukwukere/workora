"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea } from "@/components/ui/form";
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
} from "@/lib/icons";
import { api } from "@/lib/api";

interface AdminCategory {
 id: string;
 slug: string;
 name: string;
 description: string | null;
 kind: string;
 sort_order: number | string;
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
 description="The catalog freelancers and clients navigate by. Names, slugs and counts come from the live API."
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
 <div key={i} className="card h-40 animate-pulse bg-neutral-50" />
 ))}
 </div>
 ) : items.length === 0 ? (
 <EmptyState
 icon={<Icon icon={InformationCircleIcon} size={22} strokeWidth={1.8} />}
 title="No categories yet"
 description="Create the first category; it goes live in browse and posting flows immediately."
 />
 ) : (
 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
 {items.map((c) => (
 <article key={c.id} className="card flex flex-col gap-3 p-5">
 <div className="flex items-start justify-between gap-2">
 <div className="min-w-0">
 <h2 className="text-sm font-semibold text-neutral-900">{c.name}</h2>
 <p className="mt-0.5 text-xs text-neutral-500">
 {formatNumber(n(c.projects_count))} projects · {formatNumber(n(c.skills_count))} skills
 </p>
 </div>
 <button
 type="button"
 aria-label={`Edit ${c.name}`}
 onClick={() => setEditor({ mode: "edit", category: c })}
 className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
 >
 <Icon icon={Edit02Icon} size={16} strokeWidth={1.8} />
 </button>
 </div>
 <p className="line-clamp-3 text-[13px] leading-relaxed text-neutral-600">{c.description || "No description yet."}</p>
 <div className="mt-auto flex flex-wrap items-center gap-2">
 <Badge tone="outline">
 <span className="font-mono text-[11px]">{c.slug}</span>
 </Badge>
 <span className="text-xs text-neutral-400">sort {n(c.sort_order)}</span>
 </div>
 </article>
 ))}
 </div>
 )}

 <p className="flex items-center gap-2 text-xs text-neutral-500">
 <Icon icon={InformationCircleIcon} size={14} strokeWidth={1.8} />
 Skill links shown are the live skills_count per category; the console does not edit skill mappings yet.
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
 if (mode === "create") {
 const sort = Number(sortOrder);
 await api<{ id: string }>("/api/v1/admin/categories", {
 method: "POST",
 body: {
 slug: derivedSlug,
 name: name.trim(),
 description: description.trim(),
 sort_order: Number.isFinite(sort) ? sort : 100,
 },
 });
 toast.success("Category created");
 } else if (existing) {
 await api<{ id: string }>(`/api/v1/admin/categories/${encodeURIComponent(existing.id)}`, {
 method: "PATCH",
 body: { name: name.trim(), description: description.trim() },
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
 <>
 <Field label="Slug" hint="Derived from the name.">
 <Input id="category-slug" value={derivedSlug} readOnly className="bg-neutral-50 font-mono text-neutral-600" />
 </Field>
 <Field label="Sort order" hint="Lower sorts earlier in browse. Defaults to 100.">
 <Input id="category-sort" type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
 </Field>
 </>
 ) : null}
 <Field label="Description">
 <Textarea id="category-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What falls under this category, in one or two sentences." />
 </Field>
 </div>
 </Modal>
 );
}
