import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon, ArrowRight02Icon, Globe02Icon } from "@/lib/icons";
import { apiServer } from "@/lib/api-data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Categories",
  description:
    "Browse the nine crafts on Workora: web and mobile development, design, marketing, data and AI, and more. Every category is open to remote talent worldwide.",
};

interface PublicCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  sort_order?: number;
  kind?: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  "web-development": "SourceCodeIcon",
  "mobile-development": "SmartPhone01Icon",
  "product-design": "PaletteIcon",
  "data-ai": "ChartLineIcon",
  marketing: "MarketingIcon",
  "writing-translation": "TextIcon",
  "video-audio": "Video01Icon",
  "virtual-assistance": "Task01Icon",
  "brand-graphic-design": "Globe02Icon",
};

export default async function CategoriesPage() {
  let categories: PublicCategory[] | null = null;
  try {
    const data = await apiServer<{ categories: PublicCategory[] }>("/api/v1/categories", {
      public: true,
    });
    categories = [...data.categories].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
    );
  } catch {
    categories = null;
  }

  return (
    <div className="bg-white">
      {/* Hero strip */}
      <section className="border-b border-neutral-200 bg-neutral-50/60">
        <div className="container-page flex flex-col gap-6 py-12 sm:py-16">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-700">Categories</p>
            <h1 className="mt-3 max-w-[48ch] text-4xl font-semibold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl text-wrap-balance">
              Nine crafts, one standard
            </h1>
            <p className="mt-4 max-w-[58ch] text-lg leading-relaxed text-neutral-600">
              Every discipline on Workora is scoped, staffed and paid the same way: brief, milestone, approval,
              release. Pick a craft to see who is available.
            </p>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="container-page py-12">
        {categories === null ? (
          <div className="rounded-xl border border-neutral-200 bg-white flex flex-col items-center gap-2 p-10 text-center">
            <h2 className="text-base font-semibold text-neutral-900">Categories could not be loaded</h2>
            <p className="max-w-md text-sm leading-relaxed text-neutral-600">
              Something went wrong while reaching the marketplace. Refresh the page to try again, or check back in a
              few minutes.
            </p>
            <Button href="/categories" variant="secondary" className="mt-3">
              Refresh
            </Button>
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white flex flex-col items-center gap-2 p-10 text-center">
            <h2 className="text-base font-semibold text-neutral-900">No categories yet</h2>
            <p className="max-w-md text-sm leading-relaxed text-neutral-600">
              Categories are being set up. Refresh the page in a few minutes to see the full list.
            </p>
          </div>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => {
              const CategoryIcon = CATEGORY_ICONS[category.slug] ?? "Task01Icon";
              return (
                <li key={category.id}>
                  <Link
                    href={`/find-talent?category=${encodeURIComponent(category.slug)}`}
                    className="flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-6 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
                  >
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                        <Icon icon={CategoryIcon as any} size={22} strokeWidth={1.7} />
                      </span>
                      <Icon
                        icon={ArrowRight02Icon as any}
                        size={18}
                        strokeWidth={1.8}
                        className="text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600"
                      />
                    </div>
                    <h2 className="text-lg font-semibold tracking-tight text-neutral-900">{category.name}</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{category.description}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Remote everywhere */}
      <section className="container-page pb-12">
        <div
          className={cn(
            "flex flex-col items-start gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-6 sm:p-7",
            "lg:flex-row lg:items-center lg:justify-between",
          )}
        >
          <div className="flex items-start gap-4">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700">
              <Icon icon={Globe02Icon as any} size={20} strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Remote everywhere</h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-neutral-600">
                Every category on Workora is remote-friendly by default. Search worldwide, or narrow to a region,
                timezone overlap or language from the filter bar on Find talent.
              </p>
            </div>
          </div>
          <Button href="/find-talent" variant="secondary" className="shrink-0">
            Open Find talent
            <Icon icon={ArrowRight02Icon as any} size={15} strokeWidth={1.8} />
          </Button>
        </div>
      </section>

      {/* CTA band */}
      <section className="container-page pb-16">
        <div className="flex flex-col items-center rounded-2xl border border-neutral-200 px-6 py-14 text-center">
          <h2 className="max-w-lg text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl text-wrap-balance">
            Know your craft and want in?
          </h2>
          <p className="mt-3 max-w-md leading-relaxed text-neutral-600">
            Create a free profile and start appearing in search for the categories above.
          </p>
          <Button href="/register" size="lg" className="mt-6">
            Create your profile
            <Icon icon={ArrowRight02Icon as any} size={16} strokeWidth={1.8} />
          </Button>
        </div>
      </section>
    </div>
  );
}
