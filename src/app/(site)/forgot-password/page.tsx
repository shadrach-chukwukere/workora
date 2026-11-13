"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Logo } from "@/components/ui/logo";
import { Icon, ArrowLeft02Icon, SentIcon } from "@/lib/icons";
import { requestPasswordReset } from "../contact/actions";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const COOLDOWN_MS = 30_000;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (sentTo == null || resendAvailableAt <= now) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [sentTo, resendAvailableAt, now]);

  const secondsLeft = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));

  async function send(address: string) {
    setSending(true);
    const result = await requestPasswordReset(address);
    setSending(false);
    if (!result.ok) {
      toast.error("Could not send reset link", { description: result.message });
      return;
    }
    setSentTo(address);
    setResendAvailableAt(Date.now() + COOLDOWN_MS);
    setNow(Date.now());
    toast.success("Reset link sent", {
      description: "Check your inbox and spam folder.",
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const address = email.trim();
    if (!EMAIL_RE.test(address)) {
      setError("Enter a valid email address");
      return;
    }
    setError(null);
    send(address);
  }

  function onResend() {
    if (!sentTo) return;
    if (Date.now() < resendAvailableAt) {
      toast.error(`Please wait ${Math.ceil((resendAvailableAt - Date.now()) / 1000)}s before resending`);
      return;
    }
    send(sentTo);
  }

  if (sentTo) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16">
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <Icon icon={SentIcon as any} size={26} strokeWidth={1.6} />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-900">Check your inbox</h1>
          <p className="mt-2 leading-relaxed text-neutral-600">
            If an account exists for <span className="font-medium text-neutral-900">{sentTo}</span>, we sent a
            reset link. It expires in 30 minutes.
          </p>
          <p className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-[13px] text-neutral-600">
            Nothing there? Check your spam or promotions folder. Some mail providers file transactional mail
            there by default.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <Button onClick={onResend} variant="secondary" disabled={secondsLeft > 0} loading={sending}>
              {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend reset link"}
            </Button>
            <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
              <Icon icon={ArrowLeft02Icon as any} size={15} strokeWidth={1.8} />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16">
      <div className="rounded-xl border border-neutral-200 bg-white p-8">
        <Logo href="/" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-900">Reset your password</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
          Enter the email you use for Workora. If an account exists, we will send a reset link.
        </p>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
          <Field label="Email" required error={error ?? undefined}>
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" loading={sending} className="w-full">
            Send reset link
          </Button>
        </form>
        <Link
          href="/login"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
        >
          <Icon icon={ArrowLeft02Icon as any} size={15} strokeWidth={1.8} />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
