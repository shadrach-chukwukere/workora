import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  StarIcon,
  Location01Icon,
  Briefcase01Icon,
  FavouriteIcon,
  ArrowRight01Icon,
  CheckmarkBadge01Icon,
} from "@hugeicons/core-free-icons";

/* -------------------------------------------------------------------------- */
/*  Data                                                                      */
/* -------------------------------------------------------------------------- */

type Developer = {
  id: string;
  name: string;
  location: string;
  rate: number;
  rating: number;
  jobs: number;
  headline: string;
  bio: string;
  skills: string[];
  available: boolean;
  topRated?: boolean;
  avatar?: string;
};

const DEVELOPERS: Developer[] = [
  {
    id: "ravindra",
    name: "Ravindra K.",
    location: "Abohar, India",
    rate: 6,
    rating: 4.6,
    jobs: 56,
    headline: "Top Rated Full Stack Developer",
    bio: "100% job success, 1,500+ hours worked and 10+ years of tech experience. I help businesses ship reliable web products without the drama.",
    skills: ["Full-Stack Development", "WordPress", "Laravel", "PHP", "MySQL"],
    available: true,
    topRated: true,
  },
  {
    id: "asmar",
    name: "Muhammad Asmar N.",
    location: "Faisalabad, Pakistan",
    rate: 10,
    rating: 5.0,
    jobs: 73,
    headline: "SaaS & AI Application Engineer",
    bio: "I help startups and growing businesses build fast, scalable SaaS platforms, AI-powered applications, custom ERP systems, and web and mobile apps.",
    skills: ["Full-Stack Development", "API Integration", "JavaScript", "Python", "AI"],
    available: true,
    topRated: true,
  },
  {
    id: "dheeraj",
    name: "Dheeraj G.",
    location: "Solihull, United Kingdom",
    rate: 20,
    rating: 4.7,
    jobs: 98,
    headline: "Top Rated Full Stack Developer",
    bio: "React, Next.js, Node.js, AI, SaaS and mobile apps. 20+ years of experience turning complicated ideas into products people actually enjoy using.",
    skills: ["Full-Stack Development", "API Integration", "React", "Next.js", "Node.js"],
    available: false,
    topRated: true,
  },
  {
    id: "atman",
    name: "Atman K.",
    location: "Surat, India",
    rate: 20,
    rating: 4.9,
    jobs: 81,
    headline: "Web Application Specialist",
    bio: "Building a good web application takes more than writing code. It requires the right technology, a clear plan, good performance, and an understanding of your users.",
    skills: ["Full-Stack Development", "JavaScript", "Web Apps", "Node.js", "React"],
    available: true,
  },
  {
    id: "john",
    name: "John Hendrix N.",
    location: "Olongapo, Philippines",
    rate: 6,
    rating: 4.9,
    jobs: 5,
    headline: "Laravel & Vue.js Developer",
    bio: "Full Stack Developer with 5 years of experience specializing in Laravel and Vue.js. Throughout my career I have delivered clean, maintainable apps.",
    skills: ["Full-Stack Development", "JavaScript", "Vue.js", "Laravel", "GraphQL"],
    available: true,
  },
  {
    id: "oleg",
    name: "Oleg U.",
    location: "Lviv, Ukraine",
    rate: 25,
    rating: 4.8,
    jobs: 42,
    headline: "Product-minded Full Stack Developer",
    bio: "I partner with founders to turn rough ideas into polished, production-ready products. Clear communication, steady delivery and no surprises.",
    skills: ["Full-Stack Development", "React", "TypeScript", "Node.js", "AWS"],
    available: false,
  },
];

const AVATAR_TONES = [
  "bg-brand-100 text-brand-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
];

const MAX_VISIBLE_SKILLS = 3;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

type SortKey = "recommended" | "rate-asc" | "rating" | "jobs";

/* -------------------------------------------------------------------------- */
/*  Card                                                                      */
/* -------------------------------------------------------------------------- */

function DeveloperCard({
  dev,
  tone,
  saved,
  onToggleSave,
}: {
  dev: Developer;
  tone: string;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? dev.skills : dev.skills.slice(0, MAX_VISIBLE_SKILLS);
  const hidden = dev.skills.length - MAX_VISIBLE_SKILLS;

  return (
    <article className="group relative flex flex-col rounded-3xl border border-neutral-200 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.18)]">
      {/* Save button */}
      <button
        type="button"
        onClick={onToggleSave}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${dev.name} from saved` : `Save ${dev.name}`}
        className={`absolute right-5 top-5 grid size-10 place-items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25 ${
          saved
            ? "border-brand-200 bg-brand-50 text-brand-600"
            : "border-neutral-200 bg-white text-neutral-400 hover:border-neutral-300 hover:text-neutral-700"
        }`}
      >
        <HugeiconsIcon
          icon={FavouriteIcon}
          size={18}
          strokeWidth={1.8}
          className={saved ? "fill-brand-500" : ""}
        />
      </button>

      {/* Header */}
      <header className="flex items-center gap-4 pr-12">
        <div className="relative shrink-0">
          {dev.avatar ? (
            <img
              src={dev.avatar}
              alt=""
              className="size-16 rounded-full object-cover"
            />
          ) : (
            <div
              className={`grid size-16 place-items-center rounded-full text-lg font-semibold ${tone}`}
              aria-hidden="true"
            >
              {initials(dev.name)}
            </div>
          )}
          <span
            title={dev.available ? "Available now" : "Currently busy"}
            className={`absolute bottom-0.5 right-0.5 size-3.5 rounded-full border-2 border-white ${
              dev.available ? "bg-emerald-500" : "bg-neutral-300"
            }`}
          />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-base font-semibold text-neutral-900">
              {dev.name}
            </h3>
            {dev.topRated && (
              <HugeiconsIcon
                icon={CheckmarkBadge01Icon}
                size={18}
                className="shrink-0 text-brand-500"
                aria-label="Top rated"
              />
            )}
          </div>
          <p className="mt-1 flex items-center gap-1 text-sm text-neutral-500">
            <HugeiconsIcon icon={Location01Icon} size={15} className="shrink-0" />
            <span className="truncate">{dev.location}</span>
          </p>
        </div>
      </header>

      {/* Stats */}
      <dl className="mt-6 grid grid-cols-3 divide-x divide-neutral-200 rounded-2xl bg-neutral-50 py-3.5">
        <div className="px-4">
          <dt className="text-xs text-neutral-500">Rate</dt>
          <dd className="mt-0.5 text-sm font-semibold text-neutral-900">
            ${dev.rate}
            <span className="font-normal text-neutral-500">/hr</span>
          </dd>
        </div>
        <div className="px-4">
          <dt className="text-xs text-neutral-500">Rating</dt>
          <dd className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-neutral-900">
            <HugeiconsIcon
              icon={StarIcon}
              size={15}
              className="fill-brand-500 text-brand-500"
            />
            {dev.rating.toFixed(1)}
          </dd>
        </div>
        <div className="px-4">
          <dt className="text-xs text-neutral-500">Jobs</dt>
          <dd className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-neutral-900">
            <HugeiconsIcon
              icon={Briefcase01Icon}
              size={15}
              className="text-neutral-400"
            />
            {dev.jobs}
          </dd>
        </div>
      </dl>

      {/* Bio */}
      <div className="mt-6">
        <p className="text-sm font-semibold text-neutral-900">{dev.headline}</p>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-neutral-600">
          {dev.bio}
        </p>
      </div>

      {/* Skills */}
      <ul className="mt-5 flex flex-wrap gap-2">
        {visible.map((skill) => (
          <li
            key={skill}
            className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700"
          >
            {skill}
          </li>
        ))}
        {hidden > 0 && (
          <li>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="rounded-full border border-dashed border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-500 transition hover:border-brand-400 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25"
            >
              {expanded ? "Show less" : `+${hidden} more`}
            </button>
          </li>
        )}
      </ul>

      {/* Footer */}
      <footer className="mt-auto pt-7">
        <button
          type="button"
          className="group/cta flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30"
        >
          See profile
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={18}
            className="transition group-hover/cta:translate-x-1"
          />
        </button>
        <p className="mt-3 text-center text-xs text-neutral-500">
          {dev.available ? "Available to start this week" : "Booked, open from next month"}
        </p>
      </footer>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Grid with search, filters and sorting                                     */
/* -------------------------------------------------------------------------- */

export default function DeveloperGrid() {
  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState("All");
  const [sort, setSort] = useState<SortKey>("recommended");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const skillFilters = useMemo(() => {
    const all = new Set<string>();
    DEVELOPERS.forEach((d) => d.skills.forEach((s) => all.add(s)));
    all.delete("Full-Stack Development");
    return ["All", ...Array.from(all).sort()];
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = DEVELOPERS.filter((d) => {
      const matchesQuery =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q) ||
        d.bio.toLowerCase().includes(q) ||
        d.skills.some((s) => s.toLowerCase().includes(q));
      const matchesSkill = skill === "All" || d.skills.includes(skill);
      const matchesAvail = !availableOnly || d.available;
      return matchesQuery && matchesSkill && matchesAvail;
    });

    const sorted = [...filtered];
    if (sort === "rate-asc") sorted.sort((a, b) => a.rate - b.rate);
    if (sort === "rating") sorted.sort((a, b) => b.rating - a.rating);
    if (sort === "jobs") sorted.sort((a, b) => b.jobs - a.jobs);
    return sorted;
  }, [query, skill, sort, availableOnly]);

  const toggleSave = (id: string) =>
    setSaved((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const reset = () => {
    setQuery("");
    setSkill("All");
    setAvailableOnly(false);
    setSort("recommended");
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-16 sm:px-8 lg:py-24">
      {/* Heading */}
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
          Talent
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
          Find a full stack developer you can trust
        </h2>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          Compare rates, ratings and experience side by side, then save the people you like.
        </p>
      </div>

      {/* Toolbar */}
      <div className="mt-10 flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search developers</span>
            <HugeiconsIcon
              icon={Search01Icon}
              size={20}
              className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, skill or country"
              className="w-full rounded-full border border-neutral-200 bg-white py-3.5 pl-14 pr-5 text-sm text-neutral-900 placeholder:text-neutral-400 transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            />
          </label>

          <label className="relative">
            <span className="sr-only">Sort by</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-full appearance-none rounded-full border border-neutral-200 bg-white py-3.5 pl-5 pr-10 text-sm font-medium text-neutral-700 transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/15 sm:w-56"
            >
              <option value="recommended">Recommended</option>
              <option value="rating">Highest rated</option>
              <option value="jobs">Most jobs done</option>
              <option value="rate-asc">Lowest rate</option>
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="rotate-90" />
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {skillFilters.map((s) => {
            const active = skill === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSkill(s)}
                aria-pressed={active}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25 ${
                  active
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
                }`}
              >
                {s}
              </button>
            );
          })}

          <span className="mx-1 hidden h-6 w-px bg-neutral-200 sm:block" />

          <button
            type="button"
            role="switch"
            aria-checked={availableOnly}
            onClick={() => setAvailableOnly((v) => !v)}
            className="flex items-center gap-2.5 rounded-full px-2 py-1.5 text-sm font-medium text-neutral-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25"
          >
            <span
              className={`relative h-6 w-10 rounded-full transition ${
                availableOnly ? "bg-brand-500" : "bg-neutral-300"
              }`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
                  availableOnly ? "left-[18px]" : "left-0.5"
                }`}
              />
            </span>
            Available now
          </button>
        </div>

        <p className="text-sm text-neutral-500" aria-live="polite">
          {results.length} {results.length === 1 ? "developer" : "developers"}
          {saved.size > 0 && (
            <>
              {" "}
              <span aria-hidden="true">·</span>{" "}
              <span className="font-medium text-brand-600">{saved.size} saved</span>
            </>
          )}
        </p>
      </div>

      {/* Grid */}
      {results.length > 0 ? (
        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {results.map((dev) => (
            <DeveloperCard
              key={dev.id}
              dev={dev}
              tone={AVATAR_TONES[DEVELOPERS.indexOf(dev) % AVATAR_TONES.length]}
              saved={saved.has(dev.id)}
              onToggleSave={() => toggleSave(dev.id)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-20 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-white text-neutral-400 shadow-sm">
            <HugeiconsIcon icon={Search01Icon} size={24} />
          </div>
          <h3 className="mt-5 text-lg font-semibold text-neutral-900">
            No developers match your search
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-600">
            Try a different keyword or clear the filters to see everyone.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30"
          >
            Clear filters
          </button>
        </div>
      )}
    </section>
  );
}