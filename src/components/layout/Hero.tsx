import Link from "next/link";
import { Icon } from "@/lib/icons";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { Button } from "../ui/button";
import SocialProofBadge from "./SocialHighlight";
import { workspacePathForRole } from "@/lib/workspace";
import type { SessionAccount } from "@/components/layout/session-guard";

interface HeroProps {
  account?: SessionAccount | null;
}

export default function Hero({ account = null }: HeroProps) {
  const workspace = account ? workspacePathForRole(account.role) : "/register";

  return (
    <section className="container-page py-16 lg:py-24 lg:h-[500px] relative">
      <div className="flex justify-center">
        <SocialProofBadge
          highlightText="1M+"
          descriptionText="jobs completed, rated, and reviewed"
        />
      </div>
      <div className="flex justify-center items-center">
        <div className="lg:col-span-6">
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-neutral-900 sm:text-6xl wrap-break-word text-wrap-balance text-center">
            Where good work finds its people.
          </h1>
          <p className="mt-6 max-w-3xl mx-auto text-md sm:text-lg leading-relaxed text-neutral-600 text-center">
            Workora is the hiring marketplace for independent professionals.
            Vetted talent, milestone funding held until you approve, and one
            place for the whole arc from brief to payment.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3 justify-center">
            <Button href={workspace} size="lg">
              {account ? "Open your dashboard" : "Start hiring"}
            </Button>
            <Button href="/find-work" variant="secondary" size="lg">
              Find work
              <Icon icon={ArrowRight02Icon} size={15} strokeWidth={1.8} />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}