import { Icon } from "@/lib/icons";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { Button } from "../ui/button";
import SocialProofBadge from "./SocialHighlight";

export default function Hero() {
  const account = true;

  return (
    <section className="container-page py-16 lg:py-24 h-125">
    <div className="flex justify-center">
        <SocialProofBadge
          highlightText="1M+"
          descriptionText="jobs completed, rated, and reviewed"
        />
    </div>
      <div className="flex justify-center items-center">
        
        <div className="lg:col-span-6">
          {/* <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700">
              <span aria-hidden className="size-1.5 rounded-full bg-brand-600" />
              The marketplace for independent work
            </span> */}
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-neutral-900 sm:text-6xl wrap-break-word text-wrap-balance text-center">
            Where good work finds its people.
          </h1>
          <p className="mt-6 max-w-3xl mx-auto text-md  sm:text-lg leading-relaxed text-neutral-600 text-center">
            Workora is the hiring marketplace for independent professionals.
            Vetted talent, milestone funding held until you approve, and one
            place for the whole arc from brief to payment.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3 justify-center">
            <Button href={account ? "workspace" : "/register"} size="lg">
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
