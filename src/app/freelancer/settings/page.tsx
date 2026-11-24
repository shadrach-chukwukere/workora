"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-blocks";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AVAILABILITY_OPTIONS } from "@/lib/constants";
import { ProfileMediaPicker } from "@/components/upload/profile-media-picker";
import { PasskeyManager } from "@/components/auth/passkey-manager";
import { IdentityVerificationCard } from "@/components/verification/identity-verification";
import { PaystackPayoutCard } from "@/components/payout/paystack-payout";
import { CONTACT_LINK_FIELDS, contactSchema, toContactPayload } from "@/lib/contact";
import { Icon, Link01Icon } from "@/lib/icons";

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
  banner_url: string | null;
  phone: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  instagram_url: string | null;
  website_url: string | null;
  portfolio_url: string | null;
  headline: string | null;
  about: string | null;
  location: string | null;
  hourly_rate_minor: number | null;
  availability: "available" | "limited" | "unavailable" | null;
  response_time_hours: number | null;
  verificationRequired?: boolean;
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
          {tab === "profile" ? (
            <>
              <ProfileTab me={me} onSaved={load} />
              <PasskeyManager />
            </>
          ) : null}
          {tab === "freelancer" ? (
            <>
              <FreelancerTab me={me} onSaved={load} />
              <PaystackPayoutCard />
              {me.verificationRequired === true ? <IdentityVerificationCard onVerified={load} /> : null}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const profileSchema = z.object({
  name: z.string().min(2, "Enter your full name"),
  image: z.string().trim().url("Enter a valid image URL").or(z.literal("")),
  bannerUrl: z.string().trim().url("Enter a valid image URL").or(z.literal("")),
  ...contactSchema.shape,
});

type ProfileValues = z.infer<typeof profileSchema>;

function ProfileTab({ me, onSaved }: { me: MeUser; onSaved: () => Promise<void> }) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: me.name,
      image: me.image ?? "",
      bannerUrl: me.banner_url ?? "",
      phone: me.phone ?? "",
      github_url: me.github_url ?? "",
      linkedin_url: me.linkedin_url ?? "",
      twitter_url: me.twitter_url ?? "",
      instagram_url: me.instagram_url ?? "",
      website_url: me.website_url ?? "",
      portfolio_url: me.portfolio_url ?? "",
    },
  });

  const preview = (watch("image") ?? "").trim() || null;
  const bannerPreview = (watch("bannerUrl") ?? "").trim() || null;

  async function onSubmit(values: ProfileValues) {
    const res = await fetch("/api/v1/users/me", {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: values.name.trim(),
        image: values.image.trim() === "" ? null : values.image.trim(),
        banner_url: values.bannerUrl.trim() === "" ? null : values.bannerUrl.trim(),
        ...toContactPayload(values),
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
        <div className="flex items-center gap-5">
          <ProfileMediaPicker
            id="settings-profile-image"
            variant="avatar"
            name={me.name}
            value={preview}
            onChange={(url) => {
              setValue("image", url, { shouldValidate: true, shouldDirty: true });
              toast.success("Profile photo uploaded");
            }}
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-neutral-900">Your profile photo</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
              Click the pencil on the photo to upload. Clients see this next to your proposals.
            </p>
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

        {/* Banner image */}
        <div className="mt-7">
          <h3 className="text-sm font-semibold text-neutral-900">Profile banner</h3>
          <p className="mt-0.5 mb-3 text-xs leading-relaxed text-neutral-500">
            Shown at the top of your public profile. Click the pencil on the banner to upload a new one.
          </p>
          <ProfileMediaPicker
            id="settings-banner-image"
            variant="banner"
            value={bannerPreview}
            onChange={(url) => {
              setValue("bannerUrl", url, { shouldValidate: true, shouldDirty: true });
              toast.success("Banner uploaded");
            }}
          />
        </div>

        {/* Contact & links */}
        <div className="mt-7 border-t border-neutral-100 pt-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Icon icon={Link01Icon} size={16} strokeWidth={1.8} />
            Contact & links
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
            Add the places clients can find or reach you. These appear on your public profile.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Phone number" hint="Shown on your public profile." error={errors.phone?.message}>
              <Input id="settings-phone" type="tel" placeholder="+1 555 000 1234" {...register("phone")} />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {CONTACT_LINK_FIELDS.map((field) => (
              <Field key={field.key} label={field.label} error={errors[field.key]?.message}>
                <Input
                  id={`settings-${field.key}`}
                  type="url"
                  inputMode="url"
                  placeholder={field.placeholder}
                  {...register(field.key)}
                />
              </Field>
            ))}
          </div>

          <p className="mt-4 text-xs text-neutral-500">
            Your email <span className="font-medium text-neutral-700">{me.email}</span> is used for sign-in and shown on your public profile.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          {isDirty ? <span className="text-xs text-neutral-400">Unsaved changes</span> : null}
          <Button type="submit" size="md" loading={isSubmitting}>
            Save profile
          </Button>
        </div>
      </form>

      <PasswordCard username={me?.email ?? ""} />
    </div>
  );
}

const freelancerSchema = z.object({
  headline: z.string().min(4, "Headline is too short"),
  about: z.string().trim().max(5000, "Keep your About under 5,000 characters"),
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
      about: me.about ?? "",
      location: me.location ?? "",
      hourlyRate: me.hourly_rate_minor === null ? 0 : me.hourly_rate_minor / 100,
      availability: me.availability ?? "available",
      responseTimeHours: me.response_time_hours ?? 24,
    },
  });

  const availability = watch("availability");
  const aboutLength = (watch("about") ?? "").length;

  async function onSubmit(values: FreelancerValues) {
    const res = await fetch("/api/v1/freelancers/me", {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        headline: values.headline.trim(),
        about: values.about.trim(),
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
      <Field label="Headline" required error={errors.headline?.message} hint="Your public short note. Shown below your name, not on your banner.">
        <Input id="settings-headline" placeholder="Product engineer for SaaS teams" {...register("headline")} />
      </Field>
      <Field
        label="About"
        error={errors.about?.message}
        hint={`Public. Tell clients what you do, your experience and how you work. ${aboutLength}/5000`}
      >
        <Textarea
          id="settings-about"
          rows={6}
          placeholder="I help early-stage teams ship reliable web products…"
          {...register("about")}
        />
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

function PasswordCard({ username }: { username: string }) {
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
      <input
        type="hidden"
        name="username"
        autoComplete="username"
        value={username}
        readOnly
      />
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
