"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { RoleChoiceCards, type MarketplaceRole } from "@/components/onboarding/role-choice";
import { onboardingDestination, safeNextPath } from "@/lib/workspace";

/** After role selection, continue to the next onboarding step that is enabled. */
function destinationForRole(
  role: MarketplaceRole,
  next?: string | null,
  verificationRequired = false,
): string {
  return onboardingDestination(
    {
      role,
      needsRoleSelection: false,
      needsVerification: verificationRequired,
      verificationRequired,
    },
    safeNextPath(next),
  );
}

type SaveBody = { accountType: MarketplaceRole } | { useDefault: true };

async function saveRole(body: SaveBody): Promise<{ verificationRequired: boolean }> {
  const res = await fetch("/api/v1/users/me/account-type", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => null)) as { message?: string } | null;
  if (!res.ok) {
    throw new Error(payload?.message ?? "Could not save your account type");
  }

  const meRes = await fetch("/api/v1/users/me", { credentials: "include", cache: "no-store" });
  const me = (await meRes.json().catch(() => null)) as
    | { data?: { user?: { verificationRequired?: boolean } } }
    | null;
  return { verificationRequired: me?.data?.user?.verificationRequired === true };
}

export function RoleSelectionForm({ name, next }: { name: string; next?: string | null }) {
  const router = useRouter();
  const [role, setRole] = useState<MarketplaceRole | null>(null);
  const [busy, setBusy] = useState<"choice" | "default" | null>(null);

  async function continueWith(nextRole: MarketplaceRole | "default") {
    if (busy) return;
    if (nextRole === "default") {
      setBusy("default");
    } else {
      setBusy("choice");
    }

    try {
      const { verificationRequired } = await saveRole(
        nextRole === "default" ? { useDefault: true } : { accountType: nextRole },
      );
      const selected = nextRole === "default" ? "freelancer" : nextRole;
      const destination = destinationForRole(selected, safeNextPath(next), verificationRequired);
      toast.success(nextRole === "default" ? "Set up as a freelancer" : "Account type saved");
      router.push(destination);
      router.refresh();
    } catch (error) {
      toast.error("Couldn’t save your choice", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
      setBusy(null);
    }
  }

  return (
    <div className="container-page flex justify-center py-10 sm:py-14">
      <div className="w-full max-w-2xl">
        <Logo href="/" />
        <p className="mt-8 text-sm font-medium text-brand-700">One last step</p>
        <h1 className="mt-2 max-w-[48ch] text-3xl font-semibold leading-[1.1] tracking-tight text-neutral-900 sm:text-4xl text-wrap-balance">
          Welcome{name ? `, ${name}` : ""}. How do you want to use Workora?
        </h1>
        <p className="mt-3 text-neutral-600">
          Pick the side of the marketplace you want to start with. This can’t be changed later.
        </p>

        <div className="mt-6">
          <RoleChoiceCards selected={role} onSelect={setRole} disabled={busy !== null} />
        </div>

        <div className="mt-5 flex items-center justify-end">
          <Button
            type="button"
            size="md"
            loading={busy === "choice"}
            disabled={!role || busy !== null}
            onClick={() => role && void continueWith(role)}
          >
            Continue
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="max-w-md text-sm text-neutral-600">
            Not sure yet? Continue with the freelancer default and you can start building a profile right away.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="md"
            loading={busy === "default"}
            disabled={busy !== null}
            onClick={() => void continueWith("default")}
          >
            Continue as freelancer
          </Button>
        </div>

        <p className="mt-4 text-xs text-neutral-500">
          Your choice sets up the right workspace and public profile. It can’t be edited after this step.
        </p>
      </div>
    </div>
  );
}
