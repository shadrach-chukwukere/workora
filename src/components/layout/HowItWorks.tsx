import { BriefcaseBusinessIcon, ArrowUpRightIcon, UserRoundIcon, CheckCircle, BookmarkIcon, CodeIcon, SendIcon, LaptopIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '../ui/button'

export default function HowItWorks() {
  return (
   <section className="overflow-hidden border-t border-neutral-100 bg-[#FAFAFA]">
  <div className="container-page py-16 sm:py-20 lg:py-24">
    <div className="mx-auto max-w-3xl text-center">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
        A better way to work
      </span>

      <h2 className="mt-4 text-3xl font-semibold tracking-[-0.055em] text-neutral-950 sm:text-5xl text-wrap-balance">
        Great work starts with the right connection.
      </h2>

      <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-neutral-500">
        Whether you're building a team or building your career, Workora
        makes every step simpler.
      </p>
    </div>

    <div className="mx-auto mt-16 max-w-5xl space-y-6">
      {/* Clients */}
      <div className="group relative grid overflow-hidden rounded-[28px] bg-white md:grid-cols-[1fr_0.9fr]">
        <div className="relative z-10 flex flex-col justify-center p-7 sm:p-10 lg:p-12">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <HugeiconsIcon icon={BriefcaseBusinessIcon} className="size-5" />
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
            For clients
          </p>

          <h3 className="mt-3 max-w-md text-2xl font-semibold tracking-[-0.045em] text-neutral-950 sm:text-3xl">
            Your next great hire is closer than you think.
          </h3>

          <p className="mt-4 max-w-md text-sm leading-7 text-neutral-500">
            Find talented professionals, compare proposals and bring
            your next big idea to life.
          </p>

          <div className="mt-8 space-y-4">
            {[
              ["01", "Describe your project", "Share your goals and requirements."],
              ["02", "Meet the right people", "Explore proposals and portfolios."],
              ["03", "Get quality work done", "Collaborate and track progress."],
            ].map(([number, title, description]) => (
              <div key={number} className="flex gap-4">
                <span className="pt-0.5 text-xs font-semibold tabular-nums text-brand-600">
                  {number}
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{title}</p>
                  <p className="mt-1 text-sm text-neutral-500">{description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-9">
            <Button href="/register" size="sm">
              Start hiring <HugeiconsIcon icon={ArrowUpRightIcon} className="ml-2 size-4" />
            </Button>
          </div>
        </div>

        {/* Client illustration */}
        <div className="relative flex min-h-75 items-center justify-center overflow-hidden bg-[#F1F5FF] p-8 sm:min-h-[400px]">
          <div className="absolute -right-20 -top-20 size-72 rounded-full bg-blue-200/30 blur-3xl" />

          <div className="relative w-full max-w-85">
            <div className="rounded-2xl border border-white bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-neutral-400">Project workspace</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">Website redesign</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                  In progress
                </span>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <div className="flex -space-x-2">
                  {["bg-orange-200", "bg-blue-200", "bg-violet-200"].map((color, i) => (
                    <div key={i} className={`flex size-9 items-center justify-center rounded-full border-2 border-white ${color}`}>
                      <HugeiconsIcon icon={UserRoundIcon} className="size-4 text-neutral-600" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-neutral-500">3 professionals matched</p>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-neutral-700">Project progress</span>
                  <span className="text-neutral-400">68%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full w-[68%] rounded-full bg-brand-600" />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-4">
                <span className="text-xs text-neutral-500">Latest milestone</span>
                <span className="text-xs font-semibold text-neutral-800">Design delivery</span>
              </div>
            </div>

            <div className="absolute -bottom-7 -left-5 flex items-center gap-3 rounded-xl border border-neutral-100 bg-white p-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <HugeiconsIcon icon={CheckCircle} className="size-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-900">Milestone approved</p>
                <p className="mt-0.5 text-[10px] text-neutral-400">Project updated</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Freelancers */}
      <div className="group relative grid overflow-hidden rounded-[28px] bg-white md:grid-cols-[0.9fr_1fr]">
        {/* Freelancer illustration */}
        <div className="relative order-2 flex min-h-75 items-center justify-center overflow-hidden bg-[#F4F1FF] p-8 md:order-1 sm:min-h-[400px]">
          <div className="absolute -left-20 -bottom-20 size-72 rounded-full bg-violet-200/40 blur-3xl" />

          <div className="relative w-full max-w-85">
            <div className="rounded-2xl border border-white bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-400">Recommended opportunity</span>
                <HugeiconsIcon icon={BookmarkIcon} className="size-4 text-neutral-400" />
              </div>

              <div className="mt-5 flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <HugeiconsIcon icon={CodeIcon} className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Frontend Developer</p>
                  <p className="mt-1 text-xs text-neutral-400">Technology · Remote</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {["React", "TypeScript", "Next.js"].map((skill) => (
                  <span key={skill} className="rounded-md bg-neutral-100 px-2.5 py-1.5 text-[10px] font-medium text-neutral-600">
                    {skill}
                  </span>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-neutral-100 pt-4">
                <div>
                  <p className="text-[10px] text-neutral-400">Project budget</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">$800 – $1,500</p>
                </div>
                <span className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700">
                  Matched for you
                </span>
              </div>
            </div>

            <div className="absolute -bottom-7 -right-4 flex items-center gap-3 rounded-xl border border-neutral-100 bg-white p-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                <HugeiconsIcon icon={SendIcon} className="size-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-900">Proposal submitted</p>
                <p className="mt-0.5 text-[10px] text-neutral-400">You're one step closer</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 order-1 flex flex-col justify-center p-7 sm:p-10 lg:p-12 md:order-2">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
            <HugeiconsIcon icon={LaptopIcon} className="size-5" />
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">
            For freelancers
          </p>

          <h3 className="mt-3 max-w-md text-2xl font-semibold tracking-[-0.045em] text-neutral-950 sm:text-3xl">
            Turn your skills into opportunities.
          </h3>

          <p className="mt-4 max-w-md text-sm leading-7 text-neutral-500">
            Discover meaningful projects, showcase your expertise
            and build a career on your terms.
          </p>

          <div className="mt-8 space-y-4">
            {[
              ["01", "Build your presence", "Showcase your skills and experience."],
              ["02", "Discover opportunities", "Find projects that match your expertise."],
              ["03", "Work and get rewarded", "Deliver great work and grow your reputation."],
            ].map(([number, title, description]) => (
              <div key={number} className="flex gap-4">
                <span className="pt-0.5 text-xs font-semibold tabular-nums text-violet-600">
                  {number}
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{title}</p>
                  <p className="mt-1 text-sm text-neutral-500">{description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-9">
            <Button href="/find-work" variant="secondary" size="sm">
              Explore opportunities <HugeiconsIcon icon={ArrowUpRightIcon} className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
  )
}
