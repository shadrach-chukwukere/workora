"use client";

import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

type Mode = "hiring" | "finding";

interface Step {
  caption: string;
  helper?: string;
  image?: string;
  alt?: string;
}

const CONTENT: Record<Mode, { steps: Step[]; cta: string; href: string }> = {
  hiring: {
    steps: [
      { caption: "Posting jobs is always free" },
      {
        caption: "Get proposals and hire",
        helper: "Screen, interview, or book a consult with an expert before hiring.",
        image:
          "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80",
        alt: "Developer reviewing a project on a phone at a desk",
      },
      {
        caption: "Pay when work is done",
        image:
          "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=900&q=80",
        alt: "Team collaborating around a laptop",
      },
    ],
    cta: "Explore experts",
    href: "/find-talent",
  },
  finding: {
    steps: [
      { caption: "Create your free profile" },
      {
        caption: "Find work that fits you",
        helper: "Browse briefs with public budgets and apply in a couple of clicks.",
        image:
          "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=900&q=80",
        alt: "Code on a laptop screen",
      },
      {
        caption: "Get paid milestone by milestone",
        image:
          "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80",
        alt: "Freelancer working on a laptop at home",
      },
    ],
    cta: "Explore opportunities",
    href: "/find-work",
  },
};

/** Three-step explainer with an audience toggle, styled like a modern marketplace. */
export function HowItWorksShowcase() {
  const [mode, setMode] = useState<Mode>("hiring");
  const content = CONTENT[mode];

  return (
    <section className="border-t border-neutral-100 bg-neutral-50/60">
      <div className="container-page py-16 sm:py-20">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-3xl font-semibold tracking-[-0.05em] text-neutral-950 sm:text-4xl">
            How it works
          </h2>
          <div
            role="tablist"
            aria-label="Choose audience"
            className="inline-flex w-fit rounded-full bg-neutral-200/70 p-1"
          >
            {(["hiring", "finding"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  mode === value
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                {value === "hiring" ? "For hiring" : "For finding work"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {content.steps.map((step, index) => (
            <article key={`${mode}-${step.caption}`}>
              {step.image ? (
                <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
                  <Image
                    src={step.image}
                    alt={step.alt ?? ""}
                    width={900}
                    height={675}
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="size-full object-cover"
                  />
                </div>
              ) : (
                <div className="relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-100 via-brand-50 to-emerald-100 p-6">
                  <div className="flex flex-col items-center gap-3">
                    <LogoMark size={48} />
                    <p className="text-2xl font-semibold tracking-tight text-neutral-900">Workora</p>
                    <p className="text-sm font-medium text-neutral-700">Get started</p>
                  </div>
                  <span
                    aria-hidden="true"
                    className="absolute bottom-4 right-4 flex size-9 items-center justify-center rounded-full bg-white/80 text-neutral-700"
                  >
                    <span className="flex gap-1">
                      <span className="h-3 w-0.5 rounded-full bg-current" />
                      <span className="h-3 w-0.5 rounded-full bg-current" />
                    </span>
                  </span>
                </div>
              )}
              <h3 className="mt-4 text-lg font-medium tracking-tight text-neutral-900">
                {step.caption}
              </h3>
              {step.helper ? (
                <p className="mt-1.5 max-w-sm text-sm leading-6 text-neutral-500">
                  {step.helper}
                </p>
              ) : null}
              <span className="sr-only">Step {index + 1}</span>
            </article>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Button href={content.href} size="lg">
            {content.cta}
          </Button>
        </div>
      </div>
    </section>
  );
}

export default HowItWorksShowcase;
