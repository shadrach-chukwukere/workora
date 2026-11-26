"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactSelect, { type StylesConfig } from "react-select";
import { Icon, Search01Icon, ArrowDown01Icon } from "@/lib/icons";

interface ContextOption {
  value: "talent" | "projects";
  label: string;
}

const CONTEXT_OPTIONS: ContextOption[] = [
  { value: "talent", label: "Talent" },
  { value: "projects", label: "Projects" },
];

const contextStyles: StylesConfig<ContextOption, false> = {
  container: (base) => ({ ...base, display: "inline-flex", verticalAlign: "middle" }),
  control: (base) => ({
    ...base,
    minHeight: 24,
    height: 24,
    border: "none",
    boxShadow: "none",
    background: "transparent",
    cursor: "pointer",
    "&:hover": { border: "none" },
  }),
  valueContainer: (base) => ({ ...base, padding: 0, overflow: "visible" }),
  singleValue: (base) => ({ ...base, color: "#404040", margin: 0, fontSize: 14, fontWeight: 500 }),
  input: (base) => ({ ...base, margin: 0, padding: 0, width: 1 }),
  indicatorsContainer: (base) => ({ ...base, padding: 0, marginLeft: 2 }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({ ...base, padding: 0, color: "#737373" }),
  menu: (base) => ({
    ...base,
    minWidth: 120,
    marginTop: 6,
    zIndex: 60,
    borderRadius: 10,
    border: "1px solid #e5e5e5",
    boxShadow: "0 12px 28px -8px rgba(0,0,0,0.18)",
    overflow: "hidden",
  }),
  menuList: (base) => ({ ...base, padding: 4 }),
  option: (base, state) => ({
    ...base,
    borderRadius: 6,
    fontSize: 13,
    padding: "7px 10px",
    backgroundColor: state.isSelected ? "#f0f0fe" : state.isFocused ? "#f5f5f5" : "transparent",
    color: state.isSelected ? "#3e36a6" : "#262626",
    cursor: "pointer",
    ":active": { backgroundColor: "#e4e3fd" },
  }),
};

/** Pill search in the public header. Uses react-select for the context selector. */
export function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [context, setContext] = useState<ContextOption>(CONTEXT_OPTIONS[0]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    const base = context.value === "talent" ? "/find-talent" : "/find-work";
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
      <div className="pl-1">
        <ReactSelect<ContextOption, false>
          aria-label="Search context"
          instanceId="header-search-context"
          isSearchable={false}
          isClearable={false}
          value={context}
          options={CONTEXT_OPTIONS}
          onChange={(option) => option && setContext(option)}
          styles={contextStyles}
          components={{
            DropdownIndicator: () => (
              <Icon icon={ArrowDown01Icon} size={13} strokeWidth={1.8} aria-hidden="true" />
            ),
          }}
        />
      </div>
      <button type="submit" className="sr-only">
        Search
      </button>
    </form>
  );
}
