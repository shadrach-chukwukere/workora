import type { Availability, ExperienceLevel, MilestoneStatus, ProjectDuration, ProposalStatus } from "./types";

export const PLATFORM_NAME = "Workora";
export const PLATFORM_FEE_PERCENT = 8;
export const MIN_WITHDRAWAL = 50;

export interface CategoryBase {
 id: string;
 name: string;
 slug: string;
 description: string;
 skills: string[];
}

export const CATEGORY_BASE: CategoryBase[] = [
 {
 id: "web-development",
 name: "Web Development",
 slug: "web-development",
 description: "Websites, web apps, platforms and APIs built with modern stacks.",
 skills: ["React", "Next.js", "Vue", "Node.js", "Python", "Django", "Laravel", "TypeScript", "PostgreSQL", "Ruby on Rails", "Svelte", "GraphQL"],
 },
 {
 id: "mobile-development",
 name: "Mobile Development",
 slug: "mobile-development",
 description: "Native iOS and Android apps, cross-platform products and app modernization.",
 skills: ["Swift", "Kotlin", "React Native", "Flutter", "iOS", "Android", "Expo", "Jetpack Compose", "SwiftUI"],
 },
 {
 id: "ui-ux-design",
 name: "UI/UX Design",
 slug: "ui-ux-design",
 description: "Product design, design systems, research and interaction design.",
 skills: ["Figma", "Design Systems", "Prototyping", "User Research", "Web Design", "Mobile Design", "Accessibility", "Wireframing"],
 },
 {
 id: "brand-graphic-design",
 name: "Brand & Graphic Design",
 slug: "brand-graphic-design",
 description: "Identity systems, illustration, packaging and marketing design.",
 skills: ["Logo Design", "Brand Identity", "Illustration", "Packaging", "Print Design", "Iconography"],
 },
 {
 id: "writing-translation",
 name: "Writing & Translation",
 slug: "writing-translation",
 description: "Copywriting, technical writing, localization and editing.",
 skills: ["Copywriting", "Technical Writing", "SEO Writing", "Editing", "Localization", "Ghostwriting", "Français", "Español", "Deutsch"],
 },
 {
 id: "digital-marketing",
 name: "Digital Marketing",
 slug: "digital-marketing",
 description: "Paid acquisition, SEO, content strategy and lifecycle marketing.",
 skills: ["SEO", "Google Ads", "Meta Ads", "Email Marketing", "Content Strategy", "Analytics", "CRO"],
 },
 {
 id: "data-ai",
 name: "Data & AI",
 slug: "data-ai",
 description: "Machine learning, data engineering, analytics and applied AI.",
 skills: ["Python", "TensorFlow", "PyTorch", "Pandas", "Airflow", "LLM", "RAG", "SQL", "dbt", "Looker", "Power BI"],
 },
 {
 id: "video-audio",
 name: "Video & Audio",
 slug: "video-audio",
 description: "Video editing, motion design, podcasts and sound engineering.",
 skills: ["Premiere Pro", "After Effects", "DaVinci Resolve", "Motion Design", "Podcast Editing", "Color Grading", "Sound Design"],
 },
 {
 id: "virtual-assistance",
 name: "Virtual Assistance",
 slug: "virtual-assistance",
 description: "Admin support, operations, scheduling and customer support.",
 skills: ["Operations", "Scheduling", "Email Management", "Customer Support", "Data Entry", "Travel Planning"],
 },
];

export const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string }[] = [
 { value: "entry", label: "Entry" },
 { value: "intermediate", label: "Intermediate" },
 { value: "expert", label: "Expert" },
];

export const PROJECT_DURATIONS: { value: ProjectDuration; label: string }[] = [
 { value: "lt-1m", label: "Less than 1 month" },
 { value: "1-3m", label: "1 to 3 months" },
 { value: "3-6m", label: "3 to 6 months" },
 { value: "gt-6m", label: "More than 6 months" },
];

export const AVAILABILITY_OPTIONS: { value: Availability; label: string }[] = [
 { value: "available", label: "Available now" },
 { value: "limited", label: "Increased capacity" },
 { value: "unavailable", label: "Fully booked" },
];

export const COUNTRIES = [
 "United States",
 "United Kingdom",
 "Canada",
 "Germany",
 "France",
 "Spain",
 "Portugal",
 "Netherlands",
 "Poland",
 "Nigeria",
 "Ghana",
 "Kenya",
 "Egypt",
 "South Africa",
 "Brazil",
 "Mexico",
 "India",
 "Pakistan",
 "Singapore",
 "Australia",
 "Japan",
 "South Korea",
 "Sweden",
 "Norway",
 "Denmark",
 "Turkey",
 "Ukraine",
 "Morocco",
 "Tunisia",
 "Indonesia",
 "Philippines",
 "Colombia",
 "Argentina",
 "Ireland",
 "Israel",
 "United Arab Emirates",
];

export const PROPOSAL_STATUS_META: Record<ProposalStatus, { label: string; tone: "neutral" | "warning" | "success" | "danger" | "brand" }> = {
 pending: { label: "Pending", tone: "warning" },
 shortlisted: { label: "Shortlisted", tone: "brand" },
 accepted: { label: "Accepted", tone: "success" },
 rejected: { label: "Rejected", tone: "neutral" },
 withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export const MILESTONE_STATUS_META: Record<MilestoneStatus, { label: string; tone: "neutral" | "warning" | "success" | "danger" | "brand" }> = {
 upcoming: { label: "Upcoming", tone: "neutral" },
 funded: { label: "Funded", tone: "brand" },
 in_review: { label: "In review", tone: "warning" },
 revision: { label: "Revision requested", tone: "danger" },
 approved: { label: "Approved", tone: "success" },
 paid: { label: "Paid", tone: "success" },
};

export const SORT_OPTIONS = {
 talent: [
 { value: "recommended", label: "Recommended" },
 { value: "rating", label: "Highest rated" },
 { value: "rate-asc", label: "Hourly rate: low to high" },
 { value: "rate-desc", label: "Hourly rate: high to low" },
 { value: "projects", label: "Most projects completed" },
 ],
 projects: [
 { value: "newest", label: "Newest first" },
 { value: "budget-desc", label: "Budget: high to low" },
 { value: "budget-asc", label: "Budget: low to high" },
 { value: "proposals", label: "Fewest proposals" },
 ],
} as const;

export const RATE_RANGES = [
 { value: "0-25", label: "Up to $25/hr" },
 { value: "25-50", label: "$25 to $50/hr" },
 { value: "50-90", label: "$50 to $90/hr" },
 { value: "90-999", label: "$90+/hr" },
];

export const BUDGET_RANGES = [
 { value: "0-500", label: "Up to $500" },
 { value: "500-1500", label: "$500 to $1,500" },
 { value: "1500-3000", label: "$1,500 to $3,000" },
 { value: "3000-6000", label: "$3,000 to $6,000" },
 { value: "6000-100000", label: "$6,000+" },
];
