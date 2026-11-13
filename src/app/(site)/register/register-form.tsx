"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Logo } from "@/components/ui/logo";
import {
  Icon,
  ArrowLeft02Icon,
  Briefcase02Icon,
  CheckmarkCircle02Icon,
  EyeIcon,
  WorkIcon,
} from "@/lib/icons";
import { cn } from "@/lib/utils";

type Role = "freelancer" | "client";
type Step = 1 | 2 | 3;

const detailsSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name").max(120, "Too long"),
  email: z.email("Enter a valid email address"),
  password: z.string().min(12, "At least 12 characters for your account safety"),
});

type DetailsValues = z.infer<typeof detailsSchema>;

export default function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [terms, setTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  function goToDetails() {
    if (!role) {
      toast.error("Pick how you want to use Workora first");
      return;
    }
    setStep(2);
  }

  async function onDetailsValid(values: DetailsValues) {
    if (!terms) {
      setTermsError("Please agree to the terms to continue");
      return;
    }
    if (!role) {
      toast.error("Pick how you want to use Workora first");
      return;
    }

    setTermsError(null);
    setSending(true);

    try {
      const signup = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: window.location.origin },
        body: JSON.stringify({ name: values.name, email: values.email, password: values.password }),
      });
      const body = (await signup.json()) as { user?: { email: string }; message?: string };
      if (!signup.ok || !body.user) {
        toast.error(body.message ?? "Could not create the account — try a different email.");
        setSending(false);
        return;
      }

      const setType = await fetch("/api/v1/users/me/account-type", {
        method: "PATCH",
        headers: { "content-type": "application/json", origin: window.location.origin },
        credentials: "include",
        body: JSON.stringify({ accountType: role }),
      });
      if (!setType.ok) {
        const err = (await setType.json()) as { message?: string };
        toast.error(err.message ?? "Could not set your account type");
        setSending(false);
        return;
      }

      setStep(3);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function finish() {
    router.push(role === "freelancer" ? "/freelancer/dashboard" : "/client/dashboard");
    router.refresh();
  }

  return (
    <div className="container-page flex justify-center py-10 sm:py-14">
      <div className="w-full max-w-2xl">
        <a href="#main-content" className="skip-link" />
        <Logo href="/" />

        {/* Progress */}
        <ol className="mt-8 flex items-center gap-2 text-sm text-neutral-500" aria-label="Sign up steps">
          {(
            [
              { n: 1, label: "Account type" },
              { n: 2, label: "Your details" },
              { n: 3, label: "Done" },
            ] as const
          ).map((s, i) => {
            const active = step >= s.n;
            return (
              <li key={s.n} className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
                    active ? "border-brand-600 bg-brand-600 text-white" : "border-neutral-300 bg-white text-neutral-500",
                  )}
                >
                  {s.n}
                </span>
                <span className={cn("font-medium", active ? "text-neutral-900" : "")}>{s.label}</span>
                {i < 2 ? <span aria-hidden className="mx-1 h-px w-6 bg-neutral-200" /> : null}
              </li>
            );
          })}
        </ol>

        <h1 className="mt-8 max-w-[48ch] text-3xl font-semibold leading-[1.1] tracking-tight text-neutral-900 sm:text-4xl text-wrap-balance">
          {step === 1 && "How do you want to use Workora?"}
          {step === 2 && "A few details about you"}
          {step === 3 && "You are all set"}
        </h1>
        <p className="mt-2 text-neutral-600">
          {step === 1 && "Choose the side of the marketplace you want to start with. You can always add more later."}
          {step === 2 && "Pick a strong password and tell us who you are."}
          {step === 3 && "Your workspace is ready. Sign in whenever you want to continue."}
        </p>

        {/* Step 1: choose role */}
        {step === 1 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <RoleCard
              icon={<Icon icon={WorkIcon as any} size={22} strokeWidth={1.8} />}
              title="I am a freelancer"
              body="Post your portfolio, send proposals and get paid into milestones."
              selected={role === "freelancer"}
              onClick={() => setRole("freelancer")}
            />
            <RoleCard
              icon={<Icon icon={Briefcase02Icon as any} size={22} strokeWidth={1.8} />}
              title="I am hiring"
              body="Post a brief, review proposals and fund milestones when work lands."
              selected={role === "client"}
              onClick={() => setRole("client")}
            />
            <div className="sm:col-span-2 mt-2 flex items-center justify-end gap-4">
              <Link href="/login" className="text-sm text-neutral-600 hover:text-neutral-900">
                Already have an account?
              </Link>
              <Button onClick={goToDetails} size="md">
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {/* Step 2: details */}
        {step === 2 ? (
          <form onSubmit={handleSubmit(onDetailsValid)} className="mt-6 flex flex-col gap-4" noValidate>
            <Field label="Full name" required error={errors.name?.message}>
              <Input autoComplete="name" placeholder="Your full name" {...register("name")} />
            </Field>
            <Field label="Email" required error={errors.email?.message}>
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                {...register("email")}
              />
            </Field>
            <Field label="Password" required error={errors.password?.message} hint="At least 12 characters. Use a passphrase you will remember.">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Minimum 12 characters"
                  {...register("password")}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                >
                  <Icon icon={EyeIcon as any} size={16} strokeWidth={1.8} />
                </button>
              </div>
            </Field>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-neutral-600">
              <Checkbox
                checked={terms}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setTerms(e.target.checked); setTermsError(null); }}
                className="mt-0.5"
              />
              <span>
                I agree to the Workora terms and privacy notice. I understand freelancers pay 8% commission on milestone releases and clients pay nothing beyond their contract.
              </span>
            </label>
            {termsError ? <p className="text-sm text-rose-600">{termsError}</p> : null}
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                <Icon icon={ArrowLeft02Icon as any} size={14} strokeWidth={1.8} />
                Back
              </button>
              <Button type="submit" size="md" loading={sending}>
                Create account
              </Button>
            </div>
          </form>
        ) : null}

        {/* Step 3: done */}
        {step === 3 ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
            <Icon icon={CheckmarkCircle02Icon as any} size={26} strokeWidth={1.8} className="text-emerald-600" />
            <p className="mt-3 text-base font-semibold text-emerald-900">Your workspace is ready</p>
            <p className="mt-1 text-sm leading-relaxed text-emerald-800">
              We sent a verification email to your inbox. Until you verify, a few write actions stay on hold.
            </p>
            <div className="mt-5">
              <Button onClick={finish} size="md">
                Go to my dashboard
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RoleCard({
  icon,
  title,
  body,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition-colors",
        selected ? "border-brand-600 bg-brand-50/50 ring-1 ring-brand-600" : "border-neutral-200 bg-white hover:border-neutral-300",
      )}
    >
      <span className="inline-flex size-11 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">{icon}</span>
      <span className="text-[15px] font-semibold text-neutral-900">{title}</span>
      <span className="text-sm leading-relaxed text-neutral-600">{body}</span>
    </button>
  );
}
