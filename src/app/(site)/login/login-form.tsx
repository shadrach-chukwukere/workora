"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GoogleAuthButton, GitHubAuthButton } from "@/components/ui/social-auth-button";
import { Field, Input } from "@/components/ui/form";
import { Logo } from "@/components/ui/logo";
import { workspacePathForRole } from "@/lib/workspace";
import {
  ArrowRight02Icon,
  BiometricAccessIcon,
  Icon,
} from "@/lib/icons";
import { signInWithPasskey } from "@/lib/webauthn";
import type { Role } from "@/lib/types";
/**
 * Social sign-in via Better Auth. The request is same-origin (relative URL) so
 * the OAuth state cookie is stored on this site and survives the provider
 * round trip; next.config.ts proxies /api/auth/* to the backend.
 */
async function startSocialSignIn(provider: "google" | "github") {
  try {
    const origin = window.location.origin;
    const res = await fetch("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        provider,
        callbackURL: `${origin}/workspace`,
        errorCallbackURL: `${origin}/login?error=social_failed`,
      }),
    });
    const body = (await res.json().catch(() => null)) as {
      url?: string;
      message?: string;
    } | null;
    if (!res.ok || !body?.url) {
      toast.error(
        body?.message ?? "Social sign-in isn't available right now. Try email instead.",
      );
      return;
    }
    window.location.href = body.url;
  } catch {
    toast.error("Sign-in failed. Check your connection and try again.");
  }
}

const signInWithGoogle = () => startSocialSignIn("google");
const signInWithGitHub = () => startSocialSignIn("github");

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
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  async function routeAfterSignIn() {
    const me = await fetch("/api/v1/users/me", {
      credentials: "include",
      cache: "no-store",
    });
    const meBody = (await me.json().catch(() => null)) as {
      data?: { user?: { account_type?: string; needsRoleSelection?: boolean } };
    } | null;
    toast.success("Welcome back");
    if (meBody?.data?.user?.needsRoleSelection) {
      router.push("/onboarding/role");
    } else {
      const actualRole = (meBody?.data?.user?.account_type as Role | undefined) ?? role;
      router.push(workspacePathForRole(actualRole));
    }
    router.refresh();
  }

  async function onPasskeySignIn() {
    if (!EMAIL_RE.test(email.trim())) {
      setErrors({ email: "Enter your email to use a passkey" });
      return;
    }
    setErrors({});
    setPasskeyLoading(true);
    try {
      await signInWithPasskey(email.trim().toLowerCase());
      await routeAfterSignIn();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Passkey sign-in failed");
    } finally {
      setPasskeyLoading(false);
    }
  }

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
      const signIn = await fetch("" + "/api/auth/sign-in/email", {
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

      await routeAfterSignIn();
    } catch {
      toast.error("Sign-in failed. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-2xl border-neutral-200 bg-white lg:grid-cols-2">
        {/* Brand panel */}
        <div className="relative hidden overflow-hidden lg:block form-background">
          <div className="absolute inset-0 bg-linear-to-b from-black/75 via-black/30 to-black/5" />
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
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Sign in</h2>
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
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

          {/* Social + passkey login */}
          <div className="mt-4 flex flex-wrap gap-2">
            <GoogleAuthButton onClick={signInWithGoogle} />
            <GitHubAuthButton onClick={signInWithGitHub} />
          </div>
          <p className="mt-2 text-center text-[11px] text-neutral-500">
            New here? You’ll choose freelancer or client once after signing in.
          </p>
          <div className="mt-3">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              loading={passkeyLoading}
              onClick={onPasskeySignIn}
              className="w-full"
              title="Use your device biometrics, PIN or security key"
            >
              {!passkeyLoading ? (
                <Icon icon={BiometricAccessIcon} size={17} strokeWidth={1.8} />
              ) : null}
              Sign in with a passkey
            </Button>
            <p className="mt-2 text-center text-[11px] text-neutral-500">
              Enter your email above, then confirm with Face ID, fingerprint, PIN or a security key.
            </p>
          </div>

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