"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Briefcase02Icon,
  ChartLineIcon,
  Icon,
  MagicWand02Icon,
  MarketingIcon,
  PaletteIcon,
  SourceCodeIcon,
  TextIcon,
  type IconName,
} from "@/lib/icons";
import { cn } from "@/lib/utils";

interface CategoryItem {
  title: string;
  count: string;
  slug: string;
  tab: string;
}

const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: "dev", label: "Dev & IT", icon: SourceCodeIcon },
  { id: "ai", label: "AI & Automation", icon: MagicWand02Icon },
  { id: "design", label: "Design & Creative", icon: PaletteIcon },
  { id: "marketing", label: "Marketing", icon: MarketingIcon },
  { id: "data", label: "Data & Analytics", icon: ChartLineIcon },
  { id: "admin", label: "Admin & Support", icon: Briefcase02Icon },
  { id: "writing", label: "Writing & Content", icon: TextIcon },
];

const ITEMS: CategoryItem[] = [
  { title: "Full Stack Developers", count: "1,216+ available", slug: "web-development", tab: "dev" },
  { title: "WordPress Developers", count: "16,856+ available", slug: "web-development", tab: "dev" },
  { title: "Web Developers", count: "1,813+ available", slug: "web-development", tab: "dev" },
  { title: "Shopify Developers", count: "71,140+ available", slug: "web-development", tab: "dev" },
  { title: "Mobile App Developers", count: "42,775+ available", slug: "mobile-development", tab: "dev" },
  { title: "Webflow Developers", count: "15,211+ available", slug: "web-development", tab: "dev" },
  { title: "Front-End Developers", count: "8,687+ available", slug: "web-development", tab: "dev" },
  { title: "React.js Developers", count: "22,901+ available", slug: "web-development", tab: "dev" },
  { title: "AI Developers", count: "3,420+ available", slug: "data-ai", tab: "ai" },
  { title: "Machine Learning Engineers", count: "2,180+ available", slug: "data-ai", tab: "ai" },
  { title: "Automation Specialists", count: "4,860+ available", slug: "data-ai", tab: "ai" },
  { title: "UI/UX Designers", count: "12,340+ available", slug: "ui-ux-design", tab: "design" },
  { title: "Graphic Designers", count: "9,870+ available", slug: "brand-graphic-design", tab: "design" },
  { title: "Video Editors", count: "5,210+ available", slug: "video-audio", tab: "design" },
  { title: "Digital Marketing Experts", count: "18,450+ available", slug: "digital-marketing", tab: "marketing" },
  { title: "SEO Specialists", count: "7,930+ available", slug: "digital-marketing", tab: "marketing" },
  { title: "Data Analysts", count: "6,740+ available", slug: "data-ai", tab: "data" },
  { title: "Data Engineers", count: "4,120+ available", slug: "data-ai", tab: "data" },
  { title: "Virtual Assistants", count: "21,300+ available", slug: "virtual-assistance", tab: "admin" },
  { title: "Customer Support Specialists", count: "8,640+ available", slug: "virtual-assistance", tab: "admin" },
  { title: "Content Writers", count: "14,780+ available", slug: "writing-translation", tab: "writing" },
  { title: "Copywriters", count: "6,920+ available", slug: "writing-translation", tab: "writing" },
];

const PORTRAITS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=96&h=96&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=96&h=96&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=96&h=96&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=96&h=96&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=96&h=96&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=96&h=96&q=80",
];

/** Upwork-style category browser: scrollable icon tabs + a grid of role cards. */
export function CategoryExplorer() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const visible = ITEMS.filter((item) => item.tab === activeTab).slice(0, 10);

  return (
    <section className="border-b border-neutral-200 bg-white">
      <div className="container-page py-14 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.05em] text-neutral-950 sm:text-5xl text-wrap-balance">
            Find freelancers for every type of work
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-neutral-500">
            From first line of code to final pixel — browse by craft and see who is ready to start.
          </p>
        </div>

        {/* Tabs — horizontally scrollable on small screens */}
        <div className="mt-10 overflow-x-auto border-b border-neutral-200">
          <div role="tablist" aria-label="Freelancer categories" className="mx-auto flex min-w-max gap-2 sm:gap-4">
            {TABS.map((tab) => {
              const selected = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex min-w-[92px] flex-col items-center gap-2 border-b-2 px-2 pb-3 pt-1 transition-colors sm:min-w-[112px]",
                    selected
                      ? "border-brand-600 text-brand-700"
                      : "border-transparent text-neutral-500 hover:text-neutral-900",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-11 items-center justify-center rounded-full ring-1 transition-colors",
                      selected
                        ? "bg-brand-50 text-brand-700 ring-brand-200"
                        : "bg-white text-neutral-500 ring-neutral-200",
                    )}
                  >
                    <Icon icon={tab.icon} size={20} strokeWidth={1.7} />
                  </span>
                  <span className="whitespace-nowrap text-xs font-medium sm:text-sm">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Role cards */}
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {visible.map((item, index) => (
            <li key={`${activeTab}-${item.title}`}>
              <Link
                href={`/find-talent?category=${encodeURIComponent(item.slug)}`}
                className={cn(
                  "group flex h-full min-h-40 flex-col justify-between rounded-xl border bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-dropdown",
                  index === 0 ? "border-brand-600 ring-1 ring-brand-600" : "border-neutral-200 hover:border-brand-200",
                )}
              >
                <p className="text-[15px] font-medium leading-snug text-neutral-900 group-hover:text-brand-800">
                  {item.title}
                </p>
                <div className="mt-8 flex items-center justify-between gap-2">
                  <span className="text-xs text-neutral-500">{item.count}</span>
                  <span className="flex shrink-0 -space-x-2" aria-hidden="true">
                    {[0, 1, 2].map((offset) => (
                      <Image
                        key={offset}
                        src={PORTRAITS[(index * 3 + offset) % PORTRAITS.length]}
                        alt=""
                        width={28}
                        height={28}
                        className="size-7 rounded-full object-cover ring-2 ring-white"
                      />
                    ))}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-8 text-center">
          <Link
            href="/find-talent"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            Browse all talent
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default CategoryExplorer;
