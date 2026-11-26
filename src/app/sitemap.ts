import type { MetadataRoute } from "next";
import { apiServerOr } from "@/lib/api-data";

const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://workora.com").replace(/\/+$/, "");

// Keep the sitemap bounded: four pages of 50 public records per collection.
const MAX_PAGES = 4;

interface PublicProjectRow {
  id: string;
  clientId?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

interface PublicFreelancerRow {
  id: string;
}

function realDate(value: unknown): Date | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function pages(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index + 1);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Static, public pages. lastmod is the build/crawl date, not a claim about
  // when the content last changed.
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/categories`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/find-work`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/find-talent`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${baseUrl}/help`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/ai`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  // Best-effort reads: an unavailable API yields the static pages only.
  const [projectFeeds, freelancerFeeds] = await Promise.all([
    Promise.all(
      pages(MAX_PAGES).map((page) =>
        apiServerOr<{ projects: PublicProjectRow[] }>(
          `/api/v1/projects?status=open&perPage=50&page=${page}`,
          { projects: [] },
          true,
        ),
      ),
    ),
    Promise.all(
      pages(MAX_PAGES).map((page) =>
        apiServerOr<{ freelancers: PublicFreelancerRow[] }>(
          `/api/v1/freelancers?perPage=50&page=${page}`,
          { freelancers: [] },
          true,
        ),
      ),
    ),
  ]);

  const projects = projectFeeds.flatMap((feed) => feed.projects ?? []).slice(0, 200);
  const freelancers = freelancerFeeds.flatMap((feed) => feed.freelancers ?? []).slice(0, 200);

  // lastmod comes only from timestamps returned by the API.
  const projectPages: MetadataRoute.Sitemap = projects
    .filter((project) => Boolean(project?.id))
    .map((project) => ({
      url: `${baseUrl}/project/${encodeURIComponent(project.id)}`,
      lastModified: realDate(project.updatedAt) ?? realDate(project.publishedAt),
      changeFrequency: "weekly",
      priority: 0.6,
    }));

  const freelancerPages: MetadataRoute.Sitemap = freelancers
    .filter((person) => Boolean(person?.id))
    .map((person) => ({
      url: `${baseUrl}/freelancers/${encodeURIComponent(person.id)}`,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

  // There is no public client directory endpoint. Client profiles are derived
  // from the client ids already exposed by open project listings.
  const clientIds = new Set(
    projects.map((project) => project.clientId).filter((id): id is string => typeof id === "string" && id.length > 0),
  );
  const clientPages: MetadataRoute.Sitemap = [...clientIds].slice(0, 200).map((id) => ({
    url: `${baseUrl}/clients/${encodeURIComponent(id)}`,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticPages, ...projectPages, ...freelancerPages, ...clientPages];
}
