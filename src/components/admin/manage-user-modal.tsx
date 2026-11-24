"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { formatDateTime, formatMoney } from "@/lib/format";
import { api } from "@/lib/api";
import { Icon, Alert02Icon, TrashIcon, Edit02Icon } from "@/lib/icons";

type ContentRow = { id: string; [key: string]: unknown };
type ContentKind = "project" | "portfolio" | "review" | "experience" | "education" | "certification";

interface UserDetail {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    banner_url: string | null;
    phone: string | null;
    github_url: string | null;
    linkedin_url: string | null;
    twitter_url: string | null;
    instagram_url: string | null;
    website_url: string | null;
    portfolio_url: string | null;
    account_type: string;
    status: string;
    email_verified: boolean;
    verified: boolean;
    verification_provider: string | null;
    verification_method: string | null;
    verified_at: string | null;
    created_at: string;
    updated_at: string;
    failed_logins: number;
    locked_until: string | null;
  };
  freelancer: Record<string, unknown> | null;
  client: Record<string, unknown> | null;
  content: {
    projects: ContentRow[];
    portfolio: ContentRow[];
    reviews: ContentRow[];
    experience: ContentRow[];
    education: ContentRow[];
    certifications: ContentRow[];
  };
}

interface FormState {
  name: string;
  email: string;
  image: string;
  banner_url: string;
  phone: string;
  website_url: string;
  portfolio_url: string;
  github_url: string;
  linkedin_url: string;
  twitter_url: string;
  instagram_url: string;
  status: string;
  freelancer: {
    headline: string;
    about: string;
    hourly_rate_minor: string;
    currency: string;
    availability: string;
    response_time_hours: string;
    location: string;
    timezone: string;
    experience_level: string;
    is_featured: boolean;
    featured_rank: string;
  };
  client: {
    company_name: string;
    company_size: string;
    industry: string;
    website: string;
    about: string;
  };
}

const text = (value: unknown): string => (value == null ? "" : String(value));
const num = (value: unknown): string => (value == null ? "" : String(value));

function toForm(detail: UserDetail): FormState {
  const f = detail.freelancer ?? {};
  const c = detail.client ?? {};
  return {
    name: text(detail.user.name),
    email: text(detail.user.email),
    image: text(detail.user.image),
    banner_url: text(detail.user.banner_url),
    phone: text(detail.user.phone),
    website_url: text(detail.user.website_url),
    portfolio_url: text(detail.user.portfolio_url),
    github_url: text(detail.user.github_url),
    linkedin_url: text(detail.user.linkedin_url),
    twitter_url: text(detail.user.twitter_url),
    instagram_url: text(detail.user.instagram_url),
    status: text(detail.user.status),
    freelancer: {
      headline: text(f.headline),
      about: text(f.about),
      hourly_rate_minor: num(f.hourly_rate_minor),
      currency: text(f.currency),
      availability: text(f.availability),
      response_time_hours: num(f.response_time_hours),
      location: text(f.location),
      timezone: text(f.timezone),
      experience_level: text(f.experience_level),
      is_featured: f.is_featured === true,
      featured_rank: num(f.featured_rank),
    },
    client: {
      company_name: text(c.company_name),
      company_size: text(c.company_size),
      industry: text(c.industry),
      website: text(c.website),
      about: text(c.about),
    },
  };
}

interface FieldConfig {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "money" | "select";
  options?: Array<{ value: string; label: string }>;
}

const PROJECT_STATUS = [
  "draft", "open", "in_progress", "paused", "completed", "cancelled", "flagged",
].map((value) => ({ value, label: value.replace(/_/g, " ") }));

const CONTENT_CONFIG: Record<
  ContentKind,
  { label: string; fields: FieldConfig[]; title: (row: ContentRow) => string; subtitle: (row: ContentRow) => string }
> = {
  project: {
    label: "Projects",
    title: (row) => text(row.title) || "Untitled project",
    subtitle: (row) => `${text(row.status)} · ${row.budget_min_minor == null ? "Budget not set" : formatMoney(Number(row.budget_min_minor) / 100)}`,
    fields: [
      { key: "title", label: "Title" },
      { key: "summary", label: "Summary", type: "textarea" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "status", label: "Status", type: "select", options: PROJECT_STATUS },
      { key: "budget_min_minor", label: "Minimum budget (USD)", type: "money" },
      { key: "budget_max_minor", label: "Maximum budget (USD)", type: "money" },
    ],
  },
  portfolio: {
    label: "Portfolio",
    title: (row) => text(row.title) || "Untitled work",
    subtitle: (row) => [text(row.role), row.year == null ? "" : text(row.year)].filter(Boolean).join(" · ") || "No details",
    fields: [
      { key: "title", label: "Title" },
      { key: "summary", label: "Summary", type: "textarea" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "role", label: "Role" },
      { key: "year", label: "Year", type: "number" },
      { key: "project_url", label: "Project URL" },
      { key: "sort_order", label: "Sort order", type: "number" },
    ],
  },
  review: {
    label: "Reviews",
    title: (row) => `${text(row.rating)} stars · ${text(row.reviewer_name)} → ${text(row.reviewee_name)}`,
    subtitle: (row) => text(row.comment).slice(0, 120) || "No comment",
    fields: [
      { key: "rating", label: "Rating (1–5)", type: "number" },
      { key: "comment", label: "Comment", type: "textarea" },
    ],
  },
  experience: {
    label: "Experience",
    title: (row) => `${text(row.role)} at ${text(row.company)}`,
    subtitle: (row) => `${text(row.start_date).slice(0, 10)} – ${text(row.end_date).slice(0, 10) || "present"}`,
    fields: [
      { key: "company", label: "Company" },
      { key: "role", label: "Role" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "start_date", label: "Start date (YYYY-MM-DD)" },
      { key: "end_date", label: "End date (YYYY-MM-DD, blank for current)" },
    ],
  },
  education: {
    label: "Education",
    title: (row) => `${text(row.degree)} · ${text(row.school)}`,
    subtitle: (row) => [text(row.field), `${text(row.start_year)}–${text(row.end_year) || "present"}`].filter(Boolean).join(" · "),
    fields: [
      { key: "school", label: "School" },
      { key: "degree", label: "Degree" },
      { key: "field", label: "Field of study" },
      { key: "start_year", label: "Start year", type: "number" },
      { key: "end_year", label: "End year", type: "number" },
    ],
  },
  certification: {
    label: "Certifications",
    title: (row) => text(row.name) || "Certification",
    subtitle: (row) => [text(row.issuer), text(row.year)].filter(Boolean).join(" · ") || "No details",
    fields: [
      { key: "name", label: "Name" },
      { key: "issuer", label: "Issuer" },
      { key: "year", label: "Year", type: "number" },
      { key: "credential_url", label: "Credential URL" },
    ],
  },
};

export function ManageUserModal({
  userId,
  userName,
  onClose,
  onUpdated,
}: {
  userId: string | null;
  userName: string;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [tab, setTab] = useState<"details" | "content">("details");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ kind: ContentKind; row: ContentRow; values: Record<string, string> } | null>(null);
  const [deleting, setDeleting] = useState<{ kind: ContentKind; row: ContentRow } | null>(null);

  const load = useCallback(async (id: string) => {
    setDetail(null);
    setLoadError(null);
    try {
      const data = await api<UserDetail>(`/api/v1/admin/users/${encodeURIComponent(id)}`);
      setDetail(data);
      setForm(toForm(data));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load this account.");
    }
  }, []);

  useEffect(() => {
    if (userId) void load(userId);
    else {
      setDetail(null);
      setForm(null);
      setEditing(null);
      setDeleting(null);
      setTab("details");
    }
  }, [userId, load]);

  async function saveAccount() {
    if (!userId || !form) return;
    setSaving(true);
    try {
      const numeric = (value: string) => (value.trim() === "" ? null : Number(value));
      await api(`/api/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: {
          name: form.name,
          email: form.email,
          image: form.image || null,
          banner_url: form.banner_url || null,
          phone: form.phone || null,
          website_url: form.website_url || null,
          portfolio_url: form.portfolio_url || null,
          github_url: form.github_url || null,
          linkedin_url: form.linkedin_url || null,
          twitter_url: form.twitter_url || null,
          instagram_url: form.instagram_url || null,
          status: form.status,
          freelancer: detail?.freelancer
            ? {
                headline: form.freelancer.headline,
                about: form.freelancer.about,
                hourly_rate_minor: numeric(form.freelancer.hourly_rate_minor),
                currency: form.freelancer.currency,
                availability: form.freelancer.availability,
                response_time_hours: numeric(form.freelancer.response_time_hours),
                location: form.freelancer.location || null,
                timezone: form.freelancer.timezone || null,
                experience_level: form.freelancer.experience_level || null,
                is_featured: form.freelancer.is_featured,
                featured_rank: numeric(form.freelancer.featured_rank),
              }
            : undefined,
          client: detail?.client
            ? {
                company_name: form.client.company_name || null,
                company_size: form.client.company_size || null,
                industry: form.client.industry || null,
                website: form.client.website || null,
                about: form.client.about,
              }
            : undefined,
        },
      });
      toast.success("Account updated");
      await load(userId);
      onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  function openEditor(kind: ContentKind, row: ContentRow) {
    const values: Record<string, string> = {};
    for (const field of CONTENT_CONFIG[kind].fields) {
      const value = row[field.key];
      values[field.key] = field.type === "money" ? (value == null ? "" : String(Number(value) / 100)) : text(value);
    }
    setEditing({ kind, row, values });
  }

  async function saveContent() {
    if (!editing) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      for (const field of CONTENT_CONFIG[editing.kind].fields) {
        const raw = editing.values[field.key] ?? "";
        if (field.type === "money") body[field.key] = raw.trim() === "" ? null : Math.round(Number(raw) * 100);
        else if (field.type === "number") body[field.key] = raw.trim() === "" ? null : Number(raw);
        else body[field.key] = raw;
      }
      await api(`/api/v1/admin/content/${editing.kind}/${encodeURIComponent(editing.row.id)}`, {
        method: "PATCH",
        body,
      });
      toast.success("Content updated");
      setEditing(null);
      if (userId) await load(userId);
      onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save content");
    } finally {
      setSaving(false);
    }
  }

  async function removeContent() {
    if (!deleting || !userId) return;
    setSaving(true);
    try {
      await api(`/api/v1/admin/content/${deleting.kind}/${encodeURIComponent(deleting.row.id)}`, { method: "DELETE" });
      toast.success("Content removed");
      setDeleting(null);
      await load(userId);
      onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove content");
    } finally {
      setSaving(false);
    }
  }

  const contentGroups: Array<{ kind: ContentKind; rows: ContentRow[] }> = detail
    ? [
        { kind: "project", rows: detail.content.projects },
        { kind: "portfolio", rows: detail.content.portfolio },
        { kind: "review", rows: detail.content.reviews },
        { kind: "experience", rows: detail.content.experience },
        { kind: "education", rows: detail.content.education },
        { kind: "certification", rows: detail.content.certifications },
      ]
    : [];

  return (
    <>
    <Modal
      open={userId !== null}
      onClose={onClose}
      size="xl"
      title={`Manage ${userName}`}
      description="Full account record and content. Accounts themselves cannot be deleted."
      footer={
        tab === "details" ? (
          <>
            <Button variant="secondary" size="md" onClick={onClose} disabled={saving}>Close</Button>
            <Button size="md" loading={saving} disabled={!form} onClick={() => void saveAccount()}>Save account</Button>
          </>
        ) : (
          <Button variant="secondary" size="md" onClick={onClose} disabled={saving}>Close</Button>
        )
      }
    >
      {loadError ? (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Icon icon={Alert02Icon} size={18} strokeWidth={1.8} />
          {loadError}
        </div>
      ) : detail === null || form === null ? (
        <div className="py-16 text-center text-sm text-neutral-500">Loading account…</div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 pb-4">
            <Button size="sm" variant={tab === "details" ? "primary" : "secondary"} onClick={() => setTab("details")}>Details</Button>
            <Button size="sm" variant={tab === "content" ? "primary" : "secondary"} onClick={() => setTab("content")}>
              Content ({contentGroups.reduce((sum, group) => sum + group.rows.length, 0)})
            </Button>
            <span className="ml-auto text-xs text-neutral-400">ID {detail.user.id}</span>
          </div>

          {tab === "details" ? (
            <div className="flex flex-col gap-6">
              <section className="flex flex-wrap gap-x-8 gap-y-2 rounded-xl bg-neutral-50 p-4 text-xs text-neutral-600">
                <Meta label="Role" value={detail.user.account_type} />
                <Meta label="Joined" value={formatDateTime(detail.user.created_at)} />
                <Meta label="Updated" value={formatDateTime(detail.user.updated_at)} />
                <Meta label="Email verified" value={detail.user.email_verified ? "Yes" : "No"} />
                <Meta label="Identity verified" value={detail.user.verified ? `Yes (${detail.user.verification_provider || "manual"})` : "No"} />
                <Meta label="Failed logins" value={String(detail.user.failed_logins ?? 0)} />
                {detail.user.locked_until ? <Meta label="Locked until" value={formatDateTime(detail.user.locked_until)} /> : null}
                {detail.freelancer ? <Meta label="Rating" value={`${text(detail.freelancer.rating_avg) || "—"} (${text(detail.freelancer.rating_count) || 0})`} /> : null}
                {detail.client ? <Meta label="Lifetime spend" value={formatMoney(Number(detail.client.spent_minor ?? 0) / 100)} /> : null}
              </section>

              <Section title="Identity & contact">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                  <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                  <Field label="Account status">
                    <Select
                      ariaLabel="Account status"
                      value={form.status}
                      onChange={(status) => setForm({ ...form, status })}
                      options={[
                        { value: "active", label: "Active" },
                        { value: "restricted", label: "Restricted" },
                        { value: "suspended", label: "Suspended" },
                      ]}
                    />
                  </Field>
                  <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                  <Field label="Avatar URL"><Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} /></Field>
                  <Field label="Banner URL"><Input value={form.banner_url} onChange={(e) => setForm({ ...form, banner_url: e.target.value })} /></Field>
                  <Field label="Website"><Input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} /></Field>
                  <Field label="Portfolio URL"><Input value={form.portfolio_url} onChange={(e) => setForm({ ...form, portfolio_url: e.target.value })} /></Field>
                  <Field label="GitHub"><Input value={form.github_url} onChange={(e) => setForm({ ...form, github_url: e.target.value })} /></Field>
                  <Field label="LinkedIn"><Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} /></Field>
                  <Field label="X / Twitter"><Input value={form.twitter_url} onChange={(e) => setForm({ ...form, twitter_url: e.target.value })} /></Field>
                  <Field label="Instagram"><Input value={form.instagram_url} onChange={(e) => setForm({ ...form, instagram_url: e.target.value })} /></Field>
                </div>
              </Section>

              {detail.freelancer ? (
                <Section title="Freelancer profile">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Headline"><Input value={form.freelancer.headline} onChange={(e) => setForm({ ...form, freelancer: { ...form.freelancer, headline: e.target.value } })} /></Field>
                    <Field label="Location"><Input value={form.freelancer.location} onChange={(e) => setForm({ ...form, freelancer: { ...form.freelancer, location: e.target.value } })} /></Field>
                    <Field label="Hourly rate (USD)"><Input type="number" min={0} value={form.freelancer.hourly_rate_minor} onChange={(e) => setForm({ ...form, freelancer: { ...form.freelancer, hourly_rate_minor: e.target.value } })} /></Field>
                    <Field label="Currency"><Input value={form.freelancer.currency} onChange={(e) => setForm({ ...form, freelancer: { ...form.freelancer, currency: e.target.value } })} /></Field>
                    <Field label="Availability">
                      <Select ariaLabel="Availability" value={form.freelancer.availability} onChange={(availability) => setForm({ ...form, freelancer: { ...form.freelancer, availability } })}
                        options={["available", "limited", "unavailable"].map((value) => ({ value, label: value }))} />
                    </Field>
                    <Field label="Experience level">
                      <Select ariaLabel="Experience level" value={form.freelancer.experience_level} onChange={(experience_level) => setForm({ ...form, freelancer: { ...form.freelancer, experience_level } })}
                        options={[{ value: "", label: "Not set" }, ...["entry", "intermediate", "expert"].map((value) => ({ value, label: value }))]} />
                    </Field>
                    <Field label="Response time (hours)"><Input type="number" min={0} value={form.freelancer.response_time_hours} onChange={(e) => setForm({ ...form, freelancer: { ...form.freelancer, response_time_hours: e.target.value } })} /></Field>
                    <Field label="Timezone"><Input value={form.freelancer.timezone} onChange={(e) => setForm({ ...form, freelancer: { ...form.freelancer, timezone: e.target.value } })} /></Field>
                    <Field label="Featured rank"><Input type="number" min={0} value={form.freelancer.featured_rank} onChange={(e) => setForm({ ...form, freelancer: { ...form.freelancer, featured_rank: e.target.value } })} /></Field>
                    <Field label="About" className="sm:col-span-2"><Textarea rows={4} value={form.freelancer.about} onChange={(e) => setForm({ ...form, freelancer: { ...form.freelancer, about: e.target.value } })} /></Field>
                  </div>
                  <Checkbox label="Featured in curated talent" checked={form.freelancer.is_featured} onChange={(e) => setForm({ ...form, freelancer: { ...form.freelancer, is_featured: e.target.checked } })} />
                </Section>
              ) : null}

              {detail.client ? (
                <Section title="Client profile">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Company"><Input value={form.client.company_name} onChange={(e) => setForm({ ...form, client: { ...form.client, company_name: e.target.value } })} /></Field>
                    <Field label="Industry"><Input value={form.client.industry} onChange={(e) => setForm({ ...form, client: { ...form.client, industry: e.target.value } })} /></Field>
                    <Field label="Company website"><Input value={form.client.website} onChange={(e) => setForm({ ...form, client: { ...form.client, website: e.target.value } })} /></Field>
                    <Field label="Company size">
                      <Select ariaLabel="Company size" value={form.client.company_size} onChange={(company_size) => setForm({ ...form, client: { ...form.client, company_size } })}
                        options={[{ value: "", label: "Not set" }, ...["1-10", "11-50", "51-200", "201-1000", "1000+"].map((value) => ({ value, label: value }))]} />
                    </Field>
                    <Field label="About" className="sm:col-span-2"><Textarea rows={4} value={form.client.about} onChange={(e) => setForm({ ...form, client: { ...form.client, about: e.target.value } })} /></Field>
                  </div>
                </Section>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {contentGroups.every((group) => group.rows.length === 0) ? (
                <div className="rounded-xl border border-neutral-200 px-6 py-12 text-center text-sm text-neutral-500">
                  This account has no projects, portfolio items, reviews or profile entries yet.
                </div>
              ) : null}
              {contentGroups.map((group) =>
                group.rows.length === 0 ? null : (
                  <section key={group.kind} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-neutral-900">{CONTENT_CONFIG[group.kind].label}</h3>
                      <Badge tone="neutral">{group.rows.length}</Badge>
                    </div>
                    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200">
                      {group.rows.map((row) => (
                        <li key={row.id} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-neutral-900">{CONTENT_CONFIG[group.kind].title(row)}</p>
                              <p className="truncate text-xs text-neutral-500">{CONTENT_CONFIG[group.kind].subtitle(row)}</p>
                            </div>
                            <button
                              type="button"
                              aria-label={`Edit ${CONTENT_CONFIG[group.kind].label} item`}
                              onClick={() => openEditor(group.kind, row)}
                              className="inline-flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                            >
                              <Icon icon={Edit02Icon} size={15} strokeWidth={1.8} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${CONTENT_CONFIG[group.kind].label} item`}
                              onClick={() => setDeleting({ kind: group.kind, row })}
                              className="inline-flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                            >
                              <Icon icon={TrashIcon} size={15} strokeWidth={1.8} />
                            </button>
                          </div>
                          {editing?.kind === group.kind && editing.row.id === row.id ? (
                            <div className="mt-4 grid gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-2">
                              {CONTENT_CONFIG[group.kind].fields.map((field) => (
                                <Field key={field.key} label={field.label} className={field.type === "textarea" ? "sm:col-span-2" : undefined}>
                                  {field.type === "textarea" ? (
                                    <Textarea rows={3} value={editing.values[field.key] ?? ""} onChange={(e) => setEditing({ ...editing, values: { ...editing.values, [field.key]: e.target.value } })} />
                                  ) : field.type === "select" ? (
                                    <Select
                                      ariaLabel={field.label}
                                      value={editing.values[field.key] ?? ""}
                                      onChange={(value) => setEditing({ ...editing, values: { ...editing.values, [field.key]: value } })}
                                      options={field.options ?? []}
                                    />
                                  ) : (
                                    <Input
                                      type={field.type === "number" || field.type === "money" ? "number" : "text"}
                                      value={editing.values[field.key] ?? ""}
                                      onChange={(e) => setEditing({ ...editing, values: { ...editing.values, [field.key]: e.target.value } })}
                                    />
                                  )}
                                </Field>
                              ))}
                              <div className="flex justify-end gap-2 sm:col-span-2">
                                <Button variant="secondary" size="sm" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
                                <Button size="sm" loading={saving} onClick={() => void saveContent()}>Save content</Button>
                              </div>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ),
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void removeContent()}
        title="Remove this item?"
        description="This removes the selected content permanently. The account itself is never deleted."
        confirmLabel="Remove item"
        tone="danger"
        loading={saving}
      />
    </Modal>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-neutral-400">{label}: </span>
      <span className="font-medium text-neutral-700">{value}</span>
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      {children}
    </section>
  );
}
