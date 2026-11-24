"use client";

import { Logo } from "@/components/ui/logo";
import { IdentityVerificationCard } from "@/components/verification/identity-verification";

export function VerificationOnboarding({ name, next }: { name: string; next?: string | null }) {
  return (
    <div className="container-page flex justify-center py-10 sm:py-14">
      <div className="w-full max-w-3xl">
        <Logo href="/" />
        <p className="mt-8 text-sm font-medium text-brand-700">Identity check</p>
        <h1 className="mt-2 max-w-[46ch] text-3xl font-semibold leading-[1.1] tracking-tight text-neutral-900 sm:text-4xl text-wrap-balance">
          {name ? `${name}, verify your identity` : "Verify your identity"}
        </h1>
        <p className="mt-3 max-w-2xl text-neutral-600">
          This is a required step for every freelancer and client. Our team reviews every photo and document by hand.
          Once approved, you can continue to your workspace.
        </p>
        <div className="mt-7">
          <IdentityVerificationCard next={next} />
        </div>
      </div>
    </div>
  );
}
