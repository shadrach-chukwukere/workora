"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-blocks";
import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  Briefcase02Icon,
  CheckListIcon,
  Icon,
  MagicWand02Icon,
  Tick02Icon,
} from "@/lib/icons";
import { EXPERIENCE_LEVELS, PROJECT_DURATIONS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CategoryOption {
  id: string;
  name: string;
}

const schema = z
  .object({
    title: z.string().trim().min(8, "Give the project a title (at least 8 characters)"),
    summary: z.string().trim().min(1, "Add a one-line summary").max(500, "Keep the summary under 500 characters"),
    categoryId: z.string().min(1, "Choose a category"),
    skills: z
      .string()
      .refine((value) => value.split(",").map((s) => s.trim()).filter(Boolean).length >= 1, "Add at least one skill"),
    description: z.string().trim().min(40, "Describe the work in at least 40 characters"),
    budgetType: z.enum(["fixed", "hourly"]),
    fixedAmount: z.string(),
    budgetMin: z.string(),
    budgetMax: z.string(),
    duration: z.string().min(1, "Choose a timeline"),
    experienceLevel: z.string().min(1, "Choose an experience level"),
    deadline: z.string(),
    privateBrief: z.boolean(),
    commissionAck: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.budgetType === "fixed") {
      const amount = Number(values.fixedAmount);
      if (!values.fixedAmount.trim() || Number.isNaN(amount) || amount < 100) {
        ctx.addIssue({ code: "custom", path: ["fixedAmount"], message: "Enter a fixed budget of at least $100" });
      }
    } else {
      const min = Number(values.budgetMin);
      const max = Number(values.budgetMax);
      if (!values.budgetMin.trim() || Number.isNaN(min) || min < 5) {
        ctx.addIssue({ code: "custom", path: ["budgetMin"], message: "Enter a minimum hourly rate of at least $5" });
      }
      if (!values.budgetMax.trim() || Number.isNaN(max) || max < 5) {
        ctx.addIssue({ code: "custom", path: ["budgetMax"], message: "Enter a maximum hourly rate" });
      }
      if (!Number.isNaN(min) && !Number.isNaN(max) && values.budgetMin.trim() && values.budgetMax.trim() && min > max) {
        ctx.addIssue({ code: "custom", path: ["budgetMax"], message: "Maximum must be at least the minimum" });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

/** Map API validation issue paths onto form field names. */
const API_FIELD_MAP: Record<string, keyof FormValues> = {
  title: "title",
  summary: "summary",
  description: "description",
  categoryId: "categoryId",
  budgetMinMinor: "budgetMin",
  budgetMaxMinor: "budgetMax",
  durationBucket: "duration",
  experienceLevel: "experienceLevel",
  deadline: "deadline",
};

const STEPS = [
  { id: 1, label: "The project" },
  { id: 2, label: "Budget & timeline" },
  { id: 3, label: "Review & post" },
] as const;

export default function PostProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [skillIdsByName, setSkillIdsByName] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [categoriesRes, skillsRes] = await Promise.all([
          fetch((process.env.NEXT_PUBLIC_API_URL ?? "https://workora-backend-x5il.onrender.com")  + "/api/v1/categories", { credentials: "include" }),
          fetch((process.env.NEXT_PUBLIC_API_URL ?? "https://workora-backend-x5il.onrender.com")  + "/api/v1/skills", { credentials: "include" }),
        ]);
        if (cancelled) return;
        const categoriesBody = (await categoriesRes.json().catch(() => null)) as
          | { success?: boolean; data?: { categories?: { id: string; name: string }[] } }
          | null;
        if (categoriesBody?.success && categoriesBody.data?.categories) {
          setCategories(categoriesBody.data.categories.map((c) => ({ id: c.id, name: c.name })));
        }
        const skillsBody = (await skillsRes.json().catch(() => null)) as
          | { success?: boolean; data?: { skills?: { id: string; name: string }[] } }
          | null;
        if (skillsBody?.success && skillsBody.data?.skills) {
          setSkillIdsByName(new Map(skillsBody.data.skills.map((s) => [s.name.toLowerCase(), s.id])));
        }
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    trigger,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      title: "",
      summary: "",
      categoryId: "",
      skills: "",
      description: "",
      budgetType: "fixed",
      fixedAmount: "",
      budgetMin: "",
      budgetMax: "",
      duration: "",
      experienceLevel: "",
      deadline: "",
      privateBrief: false,
      commissionAck: false,
    },
  });

  const values = watch();
  const parsedSkills = useMemo(
    () => values.skills.split(",").map((s) => s.trim()).filter(Boolean),
    [values.skills],
  );
  const category = categories.find((c) => c.id === values.categoryId);

  async function goToStep(next: 1 | 2 | 3) {
    if (next > step) {
      const fields: (keyof FormValues)[][] = [
        [],
        ["title", "summary", "categoryId", "skills", "description"],
        ["title", "summary", "categoryId", "skills", "description", "budgetType", "fixedAmount", "budgetMin", "budgetMax", "duration", "experienceLevel", "deadline"],
      ];
      const ok = await trigger(fields[next - 1]);
      if (!ok) return;
    }
    setStep(next);
  }

  const budgetSummary =
    values.budgetType === "fixed"
      ? values.fixedAmount.trim()
        ? `${formatMoney(Number(values.fixedAmount))} fixed`
        : "Fixed, amount not set"
      : values.budgetMin.trim() && values.budgetMax.trim()
        ? `${formatMoney(Number(values.budgetMin))} to ${formatMoney(Number(values.budgetMax))} per hour`
        : "Hourly, range not set";

  const durationLabel = PROJECT_DURATIONS.find((d) => d.value === values.duration)?.label ?? "Not set";
  const experienceLabel = EXPERIENCE_LEVELS.find((e) => e.value === values.experienceLevel)?.label ?? "Not set";

  async function onSubmit(data: FormValues) {
    if (!data.commissionAck) {
      toast.error("Please confirm the commission note before posting.");
      return;
    }
    setSubmitting(true);
    try {
      const toMinor = (value: string) => Math.round(Number(value) * 100);
      const body: Record<string, unknown> = {
        title: data.title.trim(),
        summary: data.summary.trim(),
        description: data.description.trim(),
        categoryId: data.categoryId,
        budgetType: data.budgetType,
        experienceLevel: data.experienceLevel,
        durationBucket: data.duration,
        invitedOnly: data.privateBrief,
      };
      if (data.budgetType === "fixed") {
        body.budgetMinMinor = toMinor(data.fixedAmount);
        body.budgetMaxMinor = toMinor(data.fixedAmount);
      } else {
        body.budgetMinMinor = toMinor(data.budgetMin);
        body.budgetMaxMinor = toMinor(data.budgetMax);
      }
      if (data.deadline.trim()) body.deadline = data.deadline;

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL ?? "https://workora-backend-x5il.onrender.com")  + "/api/v1/projects", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      const envelope = (await res.json().catch(() => null)) as
        | { success?: boolean; message?: string; data?: { project?: { id: string } }; error?: { details?: { issues?: { path: string; message: string }[] } } }
        | null;
      if (!res.ok || !envelope?.success || !envelope.data?.project) {
        const issues = envelope?.error?.details?.issues ?? [];
        for (const issue of issues) {
          const field = API_FIELD_MAP[issue.path];
          if (field) setError(field, { type: "server", message: issue.message });
        }
        toast.error("Could not post the project", {
          description: envelope?.message ?? "The server rejected the brief. Check the highlighted fields.",
        });
        return;
      }

      const projectId = envelope.data.project.id;

      /* Best effort: attach skills by name from the catalog. Failures never block the post. */
      const matchedIds = parsedSkills
        .map((skill) => skillIdsByName.get(skill.toLowerCase()))
        .filter((id): id is string => Boolean(id));
      const unmatched = parsedSkills.filter((skill) => !skillIdsByName.has(skill.toLowerCase()));
      if (matchedIds.length > 0) {
        try {
          await fetch(`${(process.env.NEXT_PUBLIC_API_URL ?? "https://workora-backend-x5il.onrender.com")}/api/v1/projects/${encodeURIComponent(projectId)}/skills`, {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ skillIds: matchedIds }),
          });
        } catch {
          toast.info("Project posted, but skills could not be attached. You can add them later.");
        }
      }
      if (unmatched.length > 0) {
        toast.info("Some skills were not in the catalog", {
          description: `Not attached: ${unmatched.join(", ")}. The project itself was posted.`,
        });
      }

      toast.success("Project published successfully!");
      router.push("/client/projects");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Post a project"
        description="Three quick steps. Freelancers see the brief exactly as you write it."
        breadcrumbs={[{ label: "Projects", href: "/client/projects" }, { label: "New project" }]}
      />

      {/* Step indicator */}
      <ol className="flex items-center gap-2 sm:gap-3" aria-label="Progress">
        {STEPS.map((s, index) => {
          const done = step > s.id;
          const current = step === s.id;
          return (
            <li key={s.id} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => goToStep(s.id as 1 | 2 | 3)}
                aria-current={current ? "step" : undefined}
                className="flex min-w-0 items-center gap-2 text-left"
              >
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
                    done && "border-brand-600 bg-brand-600 text-white",
                    current && "border-brand-600 bg-brand-100 text-brand-800",
                    !done && !current && "border-neutral-200 bg-white text-neutral-400",
                  )}
                >
                  {done ? <Icon icon={Tick02Icon} size={12} strokeWidth={2.4} /> : s.id}
                </span>
                <span
                  className={cn(
                    "hidden truncate text-[13px] font-medium sm:inline",
                    current ? "text-neutral-900" : "text-neutral-500",
                  )}
                >
                  {s.label}
                </span>
              </button>
              {index < STEPS.length - 1 ? <span aria-hidden className="h-px min-w-4 flex-1 bg-neutral-200" /> : null}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={handleSubmit(onSubmit)} className="card p-5 sm:p-6 lg:col-span-2" noValidate>
          {step === 1 ? (
            <fieldset className="flex flex-col gap-5">
              <legend className="contents">
                <span className="text-sm font-semibold text-neutral-900">The project</span>
              </legend>
              <Field label="Title" required error={errors.title?.message}>
                <Input placeholder="e.g. Redesign shift-trading onboarding flow" {...register("title")} />
              </Field>
              <Field label="Summary" required error={errors.summary?.message} hint="One line, shown on the listing.">
                <Input placeholder="e.g. Multi-tenant dashboard for a healthcare analytics platform" {...register("summary")} />
              </Field>
              <Field label="Category" required error={errors.categoryId?.message}>
                <Select
                  ariaLabel="Category"
                  value={values.categoryId || null}
                  onChange={(v) => setValue("categoryId", v, { shouldDirty: true, shouldValidate: true })}
                  placeholder={categoriesLoading ? "Loading categories…" : "Choose a category"}
                  invalid={Boolean(errors.categoryId)}
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                />
              </Field>
              <Field
                label="Skills"
                required
                hint="Comma separated, e.g. Figma, Prototyping, User Research"
                error={errors.skills?.message}
              >
                <Input placeholder="Figma, Prototyping, User Research" {...register("skills")} />
              </Field>
              {parsedSkills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5" aria-label="Parsed skills">
                  {parsedSkills.map((skill) => (
                    <span key={skill} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : null}
              <Field
                label="Description"
                required
                hint="Context, deliverables, constraints. Freelancers bid on what you write here."
                error={errors.description?.message}
              >
                <Textarea rows={7} placeholder="What is this, what does done look like, and what should freelancers know before bidding?" {...register("description")} />
              </Field>
              <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-5">
                <Button type="button" variant="ghost" onClick={() => router.push("/client/projects")}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => goToStep(2)}>
                  Continue
                  <Icon icon={ArrowRight02Icon} size={15} strokeWidth={1.8} />
                </Button>
              </div>
            </fieldset>
          ) : null}

          {step === 2 ? (
            <fieldset className="flex flex-col gap-5">
              <legend className="contents">
                <span className="text-sm font-semibold text-neutral-900">Budget & timeline</span>
              </legend>

              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Budget type">
                {(
                  [
                    { value: "fixed", title: "Fixed price", body: "One deliverable set, one agreed amount." },
                    { value: "hourly", title: "Hourly rate", body: "Pay for time worked within a weekly cap." },
                  ] as const
                ).map((option) => {
                  const selected = values.budgetType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setValue("budgetType", option.value, { shouldDirty: true, shouldValidate: true })}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors",
                        selected ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-neutral-200 bg-white hover:border-neutral-300",
                      )}
                    >
                      <span className="text-sm font-semibold text-neutral-900">{option.title}</span>
                      <span className="text-xs leading-relaxed text-neutral-500">{option.body}</span>
                    </button>
                  );
                })}
              </div>

              {values.budgetType === "fixed" ? (
                <Field label="Fixed budget" required hint="Total for the whole engagement, in USD." error={errors.fixedAmount?.message}>
                  <Input type="number" min={0} inputMode="decimal" placeholder="e.g. 4000" {...register("fixedAmount")} />
                </Field>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Min rate (USD/hr)" required error={errors.budgetMin?.message}>
                    <Input type="number" min={0} inputMode="decimal" placeholder="e.g. 60" {...register("budgetMin")} />
                  </Field>
                  <Field label="Max rate (USD/hr)" required error={errors.budgetMax?.message}>
                    <Input type="number" min={0} inputMode="decimal" placeholder="e.g. 90" {...register("budgetMax")} />
                  </Field>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Timeline" required error={errors.duration?.message}>
                  <Select
                    ariaLabel="Timeline"
                    value={values.duration || null}
                    onChange={(v) => setValue("duration", v, { shouldDirty: true, shouldValidate: true })}
                    placeholder="Choose a duration"
                    invalid={Boolean(errors.duration)}
                    options={PROJECT_DURATIONS.map((d) => ({ value: d.value, label: d.label }))}
                  />
                </Field>
                <Field label="Experience level" required error={errors.experienceLevel?.message}>
                  <Select
                    ariaLabel="Experience level"
                    value={values.experienceLevel || null}
                    onChange={(v) => setValue("experienceLevel", v, { shouldDirty: true, shouldValidate: true })}
                    placeholder="Choose a level"
                    invalid={Boolean(errors.experienceLevel)}
                    options={EXPERIENCE_LEVELS.map((e) => ({ value: e.value, label: e.label }))}
                  />
                </Field>
              </div>

              <Field label="Deadline" hint="Optional. When you hope to wrap this." error={errors.deadline?.message}>
                <Input type="date" {...register("deadline")} />
              </Field>

              <Checkbox
                checked={values.privateBrief}
                onChange={(event) => setValue("privateBrief", event.target.checked, { shouldDirty: true })}
                label="Invite-only brief (private)"
              />
              <p className="-mt-3 text-xs leading-relaxed text-neutral-500">
                Private briefs are only visible to freelancers you invite. Your listings are otherwise public to vetted talent.
              </p>

              <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-5">
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                  <Icon icon={ArrowLeft02Icon} size={15} strokeWidth={1.8} />
                  Back
                </Button>
                <Button type="button" onClick={() => goToStep(3)}>
                  Continue
                  <Icon icon={ArrowRight02Icon} size={15} strokeWidth={1.8} />
                </Button>
              </div>
            </fieldset>
          ) : null}

          {step === 3 ? (
            <fieldset className="flex flex-col gap-5">
              <legend className="contents">
                <span className="text-sm font-semibold text-neutral-900">Review & post</span>
              </legend>

              <dl className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
                {[
                  { dt: "Title", dd: values.title },
                  { dt: "Summary", dd: values.summary || "Not set" },
                  { dt: "Category", dd: category?.name ?? "Not set" },
                  { dt: "Skills", dd: parsedSkills.length > 0 ? parsedSkills.join(", ") : "Not set" },
                  { dt: "Budget", dd: budgetSummary },
                  { dt: "Timeline", dd: durationLabel },
                  { dt: "Experience", dd: experienceLabel },
                  { dt: "Deadline", dd: values.deadline.trim() || "Not set" },
                  { dt: "Visibility", dd: values.privateBrief ? "Invite-only (private)" : "Open to all vetted freelancers" },
                ].map((row) => (
                  <div key={row.dt} className="grid gap-0.5 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">{row.dt}</dt>
                    <dd className="text-sm text-neutral-900 sm:col-span-2">{row.dd}</dd>
                  </div>
                ))}
              </dl>

              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900">
                  <Icon icon={Briefcase02Icon} size={15} strokeWidth={1.8} />
                  What freelancers will see
                </p>
                <p className="mt-1.5 line-clamp-4 whitespace-pre-line text-[13px] leading-relaxed text-neutral-600">{values.description || "No description yet."}</p>
              </div>

              <Checkbox
                checked={values.commissionAck}
                onChange={(event) => setValue("commissionAck", event.target.checked, { shouldDirty: true, shouldValidate: true })}
                label="I understand freelancers pay an 8% commission on this contract"
              />
              <p className="-mt-3 text-xs leading-relaxed text-neutral-500">
                The 8% commission comes out of the freelancer side of the contract. Clients never pay a platform fee on top of milestone funding.
              </p>

              <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-5">
                <Button type="button" variant="ghost" onClick={() => setStep(2)}>
                  <Icon icon={ArrowLeft02Icon} size={15} strokeWidth={1.8} />
                  Back
                </Button>
                <Button type="submit" loading={submitting} disabled={step === 3 && !values.commissionAck}>
                  <Icon icon={CheckListIcon} size={15} strokeWidth={1.8} />
                  Post project
                </Button>
              </div>
            </fieldset>
          ) : null}
        </form>

        {/* Aside */}
        <aside className="hidden h-fit flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 lg:flex">
          <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Icon icon={MagicWand02Icon} size={16} strokeWidth={1.8} className="text-brand-600" />
            How top clients write a brief
          </p>
          <ul className="flex flex-col gap-3 text-[13px] leading-relaxed text-neutral-600">
            {[
              "Lead with the problem, not the solution. Freelancers bid better when they understand why this exists.",
              "Name the deliverables and what done looks like. Acceptance criteria beat vague wishes.",
              "Share constraints up front: stack, budget, timeline, who approves.",
              "Attach examples of work you like. References align expectations faster than paragraphs.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Icon icon={Tick02Icon} size={14} strokeWidth={2.2} className="mt-0.5 shrink-0 text-brand-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="rounded-lg bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-500">
            Listings with clear acceptance criteria and a realistic budget receive stronger, faster proposals.
          </p>
        </aside>
      </div>
    </div>
  );
}
