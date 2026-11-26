"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, Search01Icon, ArrowDown01Icon } from "@/lib/icons";

type SearchContext = "talent" | "projects";

/** Pill search in the public header. A native select keeps this off the heavy client bundle. */
export function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [context, setContext] = useState<SearchContext>("talent");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    const base = context === "talent" ? "/find-talent" : "/find-work";
    router.push(q ? `${base}?q=${encodeURIComponent(q)}` : base);
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      className="flex h-10 items-center rounded-full border border-neutral-200 bg-white pl-3.5 pr-2 transition-colors focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100"
    >
      <Icon icon={Search01Icon} size={16} strokeWidth={1.8} className="shrink-0 text-neutral-400" aria-hidden="true" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search"
        aria-label="Search talent or projects"
        className="h-full w-24 min-w-0 bg-transparent px-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 lg:w-32 xl:w-44"
      />
      <span className="h-5 w-px shrink-0 bg-neutral-200" aria-hidden="true" />
      <div className="relative inline-flex items-center pl-1">
        <select
          aria-label="Search context"
          value={context}
          onChange={(e) => setContext(e.target.value as SearchContext)}
          className="cursor-pointer appearance-none bg-transparent py-1 pr-4 text-sm font-medium text-neutral-700 outline-none"
        >
          <option value="talent">Talent</option>
          <option value="projects">Projects</option>
        </select>
        <Icon
          icon={ArrowDown01Icon}
          size={13}
          strokeWidth={1.8}
          aria-hidden="true"
          className="pointer-events-none absolute right-0 text-neutral-500"
        />
      </div>
      <button type="submit" className="sr-only">
        Search
      </button>
    </form>
  );
}
