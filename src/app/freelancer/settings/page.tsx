"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-blocks";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AVAILABILITY_OPTIONS } from "@/lib/constants";

type TabId = "profile" | "freelancer";

const TABS: { id: TabId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "freelancer", label: "Freelancer profile" },
];

interface MeUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  headline: string | null;
  location: string | null;
  hourly_rate_minor: number | null;
  availability: "available" | "limited" | "unavailable" | null;
  response_time_hours: number | null;
}

interface MeResponse {
  user: MeUser;
}

async function readEnvelope<T>(res: Response): Promise<T> {
  let envelope: { success?: boolean; message?: string; data?: T } | null = null;
  try {
    envelope = (await res.json()) as { success?: boolean; message?: string; data?: T };
  } catch {
    envelope = null;
  }
  if (!res.ok || !envelope?.success || envelope.data === undefined) {
    throw new Error(envelope?.message ?? `Request failed with status ${res.status}`);
  }
  return envelope.data;
}

export default function FreelancerSettingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("profile");
  const [me, setMe] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/v1/users/me", { credentials: "include", cache: "no-store" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await readEnvelope<MeResponse>(res);
      setMe(data.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Your public profile and how clients see you in search."
        breadcrumbs={[{ label: "Freelancer", href: "/freelancer/dashboard" }, { label: "Settings" }]}
      />

      <div role="tablist" aria-label="Settings sections" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                "h-9 rounded-lg px-3.5 text-sm font-medium transition-colors",
                active ? "bg-brand-600 text-white" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? <div className="rounded-xl border border-neutral-200 bg-white max-w-3xl p-6 text-sm text-neutral-500">Loading your settings</div> : null}

      {!loading && error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 flex flex-wrap items-center justify-between gap-3 p-4" role="alert">
          <p className="text-sm text-rose-700">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => { setLoading(true); void load(); }}>
            Try again
          </Button>
        </div>
      ) : null}

      {!loading && me ? (
        <>
          {tab === "profile" ? <ProfileTab me={me} onSaved={load} /> : null}
          {tab === "freelancer" ? <FreelancerTab me={me} onSaved={load} /> : null}
        </>
      ) : null}
    </div>
  );
}

const profileSchema = z.object({
  name: z.string().min(2, "Enter your full name"),
  image: z.string().trim().url("Enter a valid image URL").or(z.literal("")),
});

type ProfileValues = z.infer<typeof profileSchema>;

function ProfileTab({ me, onSaved }: { me: MeUser; onSaved: () => Promise<void> }) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: me.name,
      image: me.image ?? "",
    },
  });

  const [imageBroken, setImageBroken] = useState(false);
  const preview = (watch("image") ?? "").trim();

  async function onSubmit(values: ProfileValues) {
    const res = await fetch("/api/v1/users/me", {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: values.name.trim(), image: values.image.trim() === "" ? null : values.image.trim() }),
    });
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    let envelope: { success?: boolean; message?: string } | null = null;
    try {
      envelope = (await res.json()) as { success?: boolean; message?: string };
    } catch {
      envelope = null;
    }
    if (!res.ok || envelope?.success === false) {
      toast.error("Could not save your profile", {
        description: envelope?.message ?? "Please try again.",
      });
      return;
    }
    reset(values);
    toast.success("Profile saved", { description: "Your public profile now shows these details." });
    await onSaved();
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border border-neutral-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="inline-flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-100 text-lg font-semibold text-brand-800"
          >
            {preview && !imageBroken ? (
              <img src={preview} alt="" className="size-full object-cover" onError={() => setImageBroken(true)} />
            ) : (
              me.name.trim().slice(0, 2).toUpperCase()
            )}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-900">Your profile</h2>
            <p className="mt-0.5 text-xs text-neutral-500">Visible to clients you work with. Email is private.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={errors.name?.message}>
            <Input id="settings-name" {...register("name")} />
          </Field>
          <Field label="Email">
            <Input id="settings-email" value={me.email} disabled readOnly aria-label="Email (read only)" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Profile image URL" hint="A direct link to a square image. Leave empty to use your initials." error={errors.image?.message}>
            <Input id="settings-image" type="url" placeholder="https://…" {...register("image")} onChange={(e) => { setImageBroken(false); void register("image").onChange(e); }} />
          </Field>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          {isDirty ? <span className="text-xs text-neutral-400">Unsaved changes</span> : null}
          <Button type="submit" size="md" loading={isSubmitting}>
            Save profile
          </Button>
        </div>
      </form>

      <PasswordCard />
    </div>
  );
}

const freelancerSchema = z.object({
  headline: z.string().min(4, "Headline is too short"),
  location: z.string().min(2, "Enter your location"),
  hourlyRate: z.number().min(0, "Rate cannot be negative").max(10000, "Keep it under $10,000"),
  availability: z.enum(["available", "limited", "unavailable"]),
  responseTimeHours: z.number().int("Use whole hours").min(0, "Cannot be negative").max(720, "Keep it under 720 hours (30 days)"),
});

type FreelancerValues = z.infer<typeof freelancerSchema>;

function FreelancerTab({ me, onSaved }: { me: MeUser; onSaved: () => Promise<void> }) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FreelancerValues>({
    resolver: zodResolver(freelancerSchema),
    defaultValues: {
      headline: me.headline ?? "",
      location: me.location ?? "",
      hourlyRate: me.hourly_rate_minor === null ? 0 : me.hourly_rate_minor / 100,
      availability: me.availability ?? "available",
      responseTimeHours: me.response_time_hours ?? 24,
    },
  });

  const availability = watch("availability");

  async function onSubmit(values: FreelancerValues) {
    const res = await fetch("/api/v1/freelancers/me", {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        headline: values.headline.trim(),
        location: values.location.trim(),
        hourly_rate_minor: Math.round(values.hourlyRate * 100),
        availability: values.availability,
        response_time_hours: values.responseTimeHours,
      }),
    });
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    let envelope: { success?: boolean; message?: string } | null = null;
    try {
      envelope = (await res.json()) as { success?: boolean; message?: string };
    } catch {
      envelope = null;
    }
    if (!res.ok || envelope?.success === false) {
      toast.error("Could not save your freelancer profile", {
        description: envelope?.message ?? "Please try again.",
      });
      return;
    }
    reset(values);
    toast.success("Freelancer profile saved", { description: "Clients see these details in search results." });
    await onSaved();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border border-neutral-200 bg-white max-w-3xl p-6">
      <Field label="Headline" required error={errors.headline?.message} hint="One line clients see in search results.">
        <Input id="settings-headline" placeholder="Product engineer for SaaS teams" {...register("headline")} />
      </Field>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Location" required error={errors.location?.message}>
          <Input id="settings-location" placeholder="Lagos, Nigeria" {...register("location")} />
        </Field>
        <Field label="Availability">
          <Select
            ariaLabel="Availability"
            value={availability}
            onChange={(v) => setValue("availability", v as FreelancerValues["availability"], { shouldDirty: true })}
            options={AVAILABILITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </Field>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Hourly rate (USD)" required error={errors.hourlyRate?.message}>
          <Input id="settings-rate" type="number" min={0} step="1" {...register("hourlyRate", { valueAsNumber: true })} />
        </Field>
        <Field label="Response time (hours)" required error={errors.responseTimeHours?.message} hint="How fast clients can expect a reply, in hours.">
          <Input id="settings-response-time" type="number" min={0} step="1" {...register("responseTimeHours", { valueAsNumber: true })} />
        </Field>
      </div>
      <div className="mt-6 flex items-center justify-end gap-3">
        {isDirty ? <span className="text-xs text-neutral-400">Unsaved changes</span> : null}
        <Button type="submit" size="md" loading={isSubmitting}>
          Save freelancer profile
        </Button>
      </div>
    </form>
  );
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    next: z.string().min(8, "Use at least 8 characters"),
    confirm: z.string().min(1, "Repeat the new password"),
  })
  .refine((values) => values.next === values.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

type PasswordValues = z.infer<typeof passwordSchema>;

function PasswordCard() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current: "", next: "", confirm: "" },
  });

  async function onSubmit(values: PasswordValues) {
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: values.current, newPassword: values.next }),
    });
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    let body: { message?: string } | null = null;
    try {
      body = (await res.json()) as { message?: string };
    } catch {
      body = null;
    }
    if (!res.ok) {
      toast.error("Could not change your password", {
        description: body?.message ?? "Check your current password and try again.",
      });
      return;
    }
    reset({ current: "", next: "", confirm: "" });
    toast.success("Password updated");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border border-neutral-200 bg-white p-6 mt-6">
      <h2 className="text-sm font-semibold text-neutral-900">Change password</h2>
      <p className="mt-0.5 text-xs text-neutral-500">Use a password you do not reuse anywhere else.</p>
      <div className="mt-4 flex flex-col gap-4">
        <Field label="Current password" required error={errors.current?.message}>
          <Input id="current-password" type="password" autoComplete="current-password" {...register("current")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" required error={errors.next?.message}>
            <Input id="new-password" type="password" autoComplete="new-password" {...register("next")} />
          </Field>
          <Field label="Confirm new password" required error={errors.confirm?.message}>
            <Input id="confirm-password" type="password" autoComplete="new-password" {...register("confirm")} />
          </Field>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button type="submit" size="md" loading={isSubmitting}>
          Update password
        </Button>
      </div>
    </form>
  );
}
