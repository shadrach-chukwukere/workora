"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-blocks";
import { Select } from "@/components/ui/select";
import { Building01Icon, Icon, UserAccountIcon } from "@/lib/icons";
import { formatMoney } from "@/lib/format";

export interface BusinessInitial {
  companyName: string;
  companySize: string;
  industry: string;
  about: string;
}

export interface AccountInitial {
  name: string;
  email: string;
  image: string;
  accountType: string;
  spentMinor: number;
  projectsCount: number;
}

const businessSchema = z.object({
  companyName: z.string().trim().min(2, "Enter your company name"),
  industry: z.string().min(1, "Choose an industry"),
  companySize: z.string().min(1, "Choose a company size"),
  about: z.string().trim().min(20, "Give a sentence or two about the company (at least 20 characters)"),
});
type BusinessForm = z.infer<typeof businessSchema>;

const accountSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name is too long"),
  image: z.string().trim().url("Enter a valid URL, e.g. https://…/avatar.png").or(z.literal("")),
});
type AccountForm = z.infer<typeof accountSchema>;

const INDUSTRY_OPTIONS = [
  { value: "SaaS", label: "SaaS" },
  { value: "Software", label: "Software" },
  { value: "Technology", label: "Technology" },
  { value: "Design & Creative", label: "Design & Creative" },
  { value: "Marketing", label: "Marketing" },
  { value: "E-commerce", label: "E-commerce" },
  { value: "Education", label: "Education" },
  { value: "Finance", label: "Finance" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Other", label: "Other" },
];

const SIZE_OPTIONS = [
  { value: "1-10", label: "1 to 10" },
  { value: "11-50", label: "11 to 50" },
  { value: "51-200", label: "51 to 200" },
  { value: "201-1000", label: "201 to 1,000" },
  { value: "1000+", label: "1,000+" },
];

function envelopeMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export function SettingsClient({ business, account }: { business: BusinessInitial; account: AccountInitial }) {
  const router = useRouter();
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BusinessForm>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      companyName: business.companyName,
      industry: business.industry,
      companySize: business.companySize,
      about: business.about,
    },
  });
  const industry = watch("industry");
  const companySize = watch("companySize");

  const accountForm = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: account.name, image: account.image },
  });
  const accountName = accountForm.watch("name");
  const accountImage = accountForm.watch("image");

  async function saveBusiness(data: BusinessForm) {
    if (savingBusiness) return;
    setSavingBusiness(true);
    try {
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL ?? "https://workora-backend-x5il.onrender.com")  + "/api/v1/clients/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company_name: data.companyName.trim(),
          company_size: data.companySize,
          industry: data.industry,
          about: data.about.trim(),
        }),
      });
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      const body = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!res.ok || !body?.success) {
        toast.error("Company profile not saved", { description: envelopeMessage(body, "The server rejected the update.") });
        return;
      }
      toast.success(envelopeMessage(body, "Company profile updated"));
      router.refresh();
    } catch {
      toast.error("Company profile not saved", { description: "Network error. Please try again." });
    } finally {
      setSavingBusiness(false);
    }
  }

  async function saveAccount(data: AccountForm) {
    if (savingAccount) return;
    setSavingAccount(true);
    try {
      const payload: Record<string, string> = { name: data.name.trim() };
      if (data.image.trim()) payload.image = data.image.trim();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL ?? "https://workora-backend-x5il.onrender.com")  + "/api/v1/users/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      const body = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!res.ok || !body?.success) {
        toast.error("Account not saved", { description: envelopeMessage(body, "The server rejected the update.") });
        return;
      }
      toast.success(envelopeMessage(body, "Profile updated"));
      router.refresh();
    } catch {
      toast.error("Account not saved", { description: "Network error. Please try again." });
    } finally {
      setSavingAccount(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Your company page and account details. Each panel saves independently."
      />

      {/* ─── Business profile ──────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(saveBusiness)} className="card flex flex-col gap-5 p-5 sm:p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <Icon icon={Building01Icon} size={16} strokeWidth={1.8} />
          Business profile
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name" required error={errors.companyName?.message}>
            <Input {...register("companyName")} />
          </Field>
          <Field label="Industry" required error={errors.industry?.message}>
            <Select
              ariaLabel="Industry"
              value={industry}
              onChange={(v) => setValue("industry", v, { shouldDirty: true, shouldValidate: true })}
              invalid={Boolean(errors.industry)}
              options={INDUSTRY_OPTIONS}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company size" required error={errors.companySize?.message}>
            <Select
              ariaLabel="Company size"
              value={companySize}
              onChange={(v) => setValue("companySize", v, { shouldDirty: true, shouldValidate: true })}
              invalid={Boolean(errors.companySize)}
              options={SIZE_OPTIONS}
            />
          </Field>
        </div>
        <Field label="About the company" required error={errors.about?.message} hint="Shown to freelancers evaluating your briefs.">
          <Textarea rows={4} {...register("about")} />
        </Field>
        <div className="flex items-center justify-end border-t border-neutral-100 pt-4">
          <Button type="submit" size="md" loading={savingBusiness}>
            Save business profile
          </Button>
        </div>
      </form>

      {/* ─── Account ───────────────────────────────────────────────────── */}
      <form onSubmit={accountForm.handleSubmit(saveAccount)} className="card flex flex-col gap-5 p-5 sm:p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <Icon icon={UserAccountIcon} size={16} strokeWidth={1.8} />
          Your account
        </p>
        <div className="flex items-center gap-4">
          <Avatar src={accountImage || null} name={accountName || account.name} size="lg" alt="" />
          <div className="min-w-0 text-xs text-neutral-500">
            <p className="truncate font-medium text-neutral-700">{account.email}</p>
            <p className="mt-0.5 capitalize">{account.accountType} account</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name" required error={accountForm.formState.errors.name?.message}>
            <Input {...accountForm.register("name")} />
          </Field>
          <Field label="Avatar image URL" error={accountForm.formState.errors.image?.message} hint="Optional. Leave blank to keep the monogram.">
            <Input placeholder="https://…/avatar.png" inputMode="url" {...accountForm.register("image")} />
          </Field>
        </div>
        <dl className="grid gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Lifetime spend</dt>
            <dd className="mt-0.5 font-semibold text-neutral-900">{formatMoney(account.spentMinor / 100)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Projects posted</dt>
            <dd className="mt-0.5 font-semibold text-neutral-900">{account.projectsCount}</dd>
          </div>
        </dl>
        <div className="flex items-center justify-end border-t border-neutral-100 pt-4">
          <Button type="submit" size="md" loading={savingAccount}>
            Save account
          </Button>
        </div>
      </form>
    </div>
  );
}
