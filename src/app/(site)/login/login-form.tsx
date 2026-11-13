"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Logo } from "@/components/ui/logo";
import { workspacePathForRole } from "@/lib/workspace";
import {
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  Icon,
  ShieldCheckIcon,
  StarIcon,
} from "@/lib/icons";
import type { Role } from "@/lib/types";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function LoginForm({
  defaultRole = "freelancer",
}: {
  defaultRole?: Role;
}) {
  const router = useRouter();
  const role = defaultRole;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email.trim()))
      next.email = "Enter a valid email address";
    if (password.trim().length === 0) next.password = "Enter your password";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const signIn = await fetch((process.env.NEXT_PUBLIC_API_URL ?? "https://workora-backend-x5il.onrender.com")  + "/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: window.location.origin,
        },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        credentials: "include",
      });
      const body = (await signIn.json()) as {
        user?: { email: string };
        token?: string;
        message?: string;
      };
      if (!signIn.ok || !body.user) {
        toast.error(body.message ?? "Invalid email or password");
        setSubmitting(false);
        return;
      }

      const me = await fetch((process.env.NEXT_PUBLIC_API_URL ?? "https://workora-backend-x5il.onrender.com")  + "/api/v1/users/me", {
        credentials: "include",
        cache: "no-store",
      });
      const meBody = (await me.json()) as {
        data?: { user?: { account_type?: string } };
      };
      const actualRole =
        (meBody.data?.user?.account_type as Role | undefined) ?? role;
      toast.success("Welcome back");
      router.push(workspacePathForRole(actualRole));
      router.refresh();
    } catch {
      toast.error("Sign-in failed. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-2xl  border-neutral-200 bg-white lg:grid-cols-2">
        {/* Brand panel */}

        {/* Brand panel */}
        <div className="relative hidden  overflow-hidden lg:block form-background">
          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-linear-to-b from-black/75 via-black/30 to-black/5" />

          {/* Brand content */}
          <div className="absolute inset-0 z-10 flex flex-col justify-between p-10 text-white">
            <div>
              <Logo href="/" className="[&_span]:text-white" />

              <h1 className="mt-10 max-w-sm text-3xl font-semibold leading-tight tracking-tight text-wrap-balance">
                Briefs in. Milestones funded. Work released on approval.
              </h1>
            </div>

          </div>
        </div>

        {/* Form panel */}
        <div className="flex flex-col p-6 sm:p-10">
          <div className="lg:hidden">
            <Logo href="/" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Sign in
          </h2>
          <form
            onSubmit={onSubmit}
            className="mt-6 flex flex-col gap-4"
            noValidate
          >
            <Field label="Email" required error={errors.email}>
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                name="email"
              />
            </Field>
            <Field label="Password" required error={errors.password}>
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                name="password"
              />
            </Field>
            <div className="flex items-center justify-between">
              <span />
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Button
              type="submit"
              size="lg"
              loading={submitting}
              className="w-full"
            >
              Sign in
            </Button>
          </form>

          <p className="mt-4 border-t border-neutral-200 pt-4 text-sm text-neutral-600 text-center">
            New to Workora?{" "}
            <Link
              href="/register"
              className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
            >
              Create an account
              <Icon
                icon={ArrowRight02Icon as any}
                size={14}
                strokeWidth={1.8}
              />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const TRUST_POINTS = [
  {
    icon: ShieldCheckIcon,
    text: "Verified work samples and identities, reviewed before they go live.",
  },
  {
    icon: CheckmarkCircle02Icon,
    text: "Milestone funding with payment held until you approve the work.",
  },
  {
    icon: StarIcon,
    text: "Real rates and real reviews. Evidence, not promises.",
  },
];
