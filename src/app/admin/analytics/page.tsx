"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
 Bar,
 BarChart,
 Area,
 AreaChart,
 CartesianGrid,
 ResponsiveContainer,
 Tooltip,
 XAxis,
 YAxis,
} from "recharts";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, StatCard } from "@/components/ui/page-blocks";
import { AdminAccessCard, classifyAdminError } from "@/components/admin/admin-access";
import {
 Alert02Icon,
 CheckmarkCircle02Icon,
 Icon,
 UserMultiple02Icon,
 Wallet02Icon,
} from "@/lib/icons";
import { api } from "@/lib/api";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";

interface MonthlyPoint {
 month: string; // YYYY-MM
 signups: number;
 projectsPosted: number;
 contractsStarted: number;
 volumeMinor: number;
}

const AXIS = {
 tick: { fill: "#737373", fontSize: 11 },
 axisLine: false as const,
 tickLine: false as const,
};

const monthLabel = (month: string): string => {
 const [year, m] = month.split("-").map(Number);
 if (!year || !m) return month;
 return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
};

export default function AdminAnalyticsPage() {
 const router = useRouter();
 const [months, setMonths] = useState<MonthlyPoint[] | null>(null);
 const [forbidden, setForbidden] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
 let cancelled = false;
 api<{ months: MonthlyPoint[] }>("/api/v1/admin/analytics/monthly?months=12")
 .then((data) => {
 if (!cancelled) setMonths(data.months);
 })
 .catch((err) => {
 if (cancelled) return;
 const classified = classifyAdminError(err);
 if (classified.kind === "login") router.replace("/login");
 else if (classified.kind === "forbidden") setForbidden(classified.message);
 else setError(classified.message);
 });
 return () => {
 cancelled = true;
 };
 }, [router]);

 if (forbidden) return <AdminAccessCard message={forbidden} />;

 if (error) {
 return (
 <div className="flex flex-col gap-6">
 <PageHeader
 title="Analytics"
 description="Twelve months of marketplace momentum, read straight from the monthly analytics table."
 breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Analytics" }]}
 />
 <EmptyState
 icon={<Icon icon={Alert02Icon} size={22} strokeWidth={1.8} />}
 title="Could not load analytics"
 description={error}
 />
 </div>
 );
 }

 if (!months) {
 return (
 <div className="flex flex-col gap-6">
 <PageHeader
 title="Analytics"
 description="Twelve months of marketplace momentum, read straight from the monthly analytics table."
 breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Analytics" }]}
 />
 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 {Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="card h-28 animate-pulse bg-neutral-50" />
 ))}
 </div>
 <div className="card h-72 animate-pulse bg-neutral-50" />
 </div>
 );
 }

 const rows = months.map((m) => ({
 ...m,
 label: monthLabel(m.month),
 volume: Number(m.volumeMinor ?? 0) / 100,
 signups: Number(m.signups ?? 0),
 projectsPosted: Number(m.projectsPosted ?? 0),
 contractsStarted: Number(m.contractsStarted ?? 0),
 }));

 const totalSignups = rows.reduce((sum, r) => sum + r.signups, 0);
 const totalPosted = rows.reduce((sum, r) => sum + r.projectsPosted, 0);
 const totalStarted = rows.reduce((sum, r) => sum + r.contractsStarted, 0);
 const totalVolume = rows.reduce((sum, r) => sum + r.volume, 0);
 const avgVolume = rows.length ? totalVolume / rows.length : 0;
 const conversion = totalSignups > 0 ? (totalStarted / totalSignups) * 100 : null;
 const currentMonth = new Date().toISOString().slice(0, 7);

 return (
 <div className="flex flex-col gap-6">
 <PageHeader
 title="Analytics"
 description="Twelve months of marketplace momentum: signups, postings, contract starts and settled volume."
 breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Analytics" }]}
 />

 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 <StatCard
 label="Signups, 12 months"
 value={formatNumber(totalSignups)}
 hint={`${formatNumber(totalPosted)} listings posted · ${formatNumber(totalStarted)} contracts started`}
 icon={<Icon icon={UserMultiple02Icon} size={16} strokeWidth={1.8} />}
 />
 <StatCard
 label="Volume, 12 months"
 value={formatMoney(totalVolume)}
 hint="Completed transactions only"
 icon={<Icon icon={Wallet02Icon} size={16} strokeWidth={1.8} />}
 />
 <StatCard
 label="Avg monthly volume"
 value={formatMoney(avgVolume)}
 hint="Zero months included in the average"
 icon={<Icon icon={Wallet02Icon} size={16} strokeWidth={1.8} />}
 />
 <StatCard
 label="Conversion"
 value={conversion == null ? "—" : formatPercent(conversion)}
 hint="Contracts started per signup"
 icon={<Icon icon={CheckmarkCircle02Icon} size={16} strokeWidth={1.8} />}
 />
 </div>

 <div className="grid gap-6 lg:grid-cols-2">
 {/* Signups per month */}
 <section className="card">
 <div className="border-b border-neutral-100 px-5 py-4">
 <h2 className="text-sm font-semibold text-neutral-900">Signups per month</h2>
 <p className="mt-0.5 text-xs text-neutral-500">New accounts across freelancers, clients and staff.</p>
 </div>
 <div className="px-3 py-4 sm:px-5">
 <div style={{ height: 240 }}>
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
 <XAxis dataKey="label" {...AXIS} />
 <YAxis width={40} {...AXIS} allowDecimals={false} />
 <Tooltip cursor={{ fill: "rgba(0,0,0,0.03)" }} />
 <Bar dataKey="signups" name="Signups" fill="var(--color-brand-500)" radius={[6, 6, 0, 0]} maxBarSize={36} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </div>
 </section>

 {/* Postings vs contract starts */}
 <section className="card">
 <div className="border-b border-neutral-100 px-5 py-4">
 <h2 className="text-sm font-semibold text-neutral-900">Listings posted vs contracts started</h2>
 <p className="mt-0.5 text-xs text-neutral-500">Supply of demand against closed deals, per calendar month.</p>
 </div>
 <div className="px-3 py-4 sm:px-5">
 <div style={{ height: 240 }}>
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
 <XAxis dataKey="label" {...AXIS} />
 <YAxis width={40} {...AXIS} allowDecimals={false} />
 <Tooltip cursor={{ fill: "rgba(0,0,0,0.03)" }} />
 <Bar dataKey="projectsPosted" name="Listings posted" fill="var(--color-brand-500)" radius={[6, 6, 0, 0]} maxBarSize={28} />
 <Bar dataKey="contractsStarted" name="Contracts started" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={28} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </div>
 </section>
 </div>

 {/* Volume per month */}
 <section className="card">
 <div className="border-b border-neutral-100 px-5 py-4">
 <h2 className="text-sm font-semibold text-neutral-900">Settled volume per month</h2>
 <p className="mt-0.5 text-xs text-neutral-500">Completed transactions, all parties, in dollars.</p>
 </div>
 <div className="px-3 py-4 sm:px-5">
 <div style={{ height: 240 }}>
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
 <XAxis dataKey="label" {...AXIS} />
 <YAxis width={56} {...AXIS} tickFormatter={(v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)} />
 <Tooltip formatter={(value) => [formatMoney(Number(value ?? 0)), "Volume"]} />
 <Area
 type="monotone"
 dataKey="volume"
 name="Volume"
 stroke="var(--color-brand-600)"
 strokeWidth={2}
 fill="rgba(90, 80, 229, 0.09)"
 activeDot={{ r: 4, fill: "var(--color-brand-600)" }}
 dot={false}
 />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </div>
 </section>

 {/* Monthly table */}
 <section className="card">
 <div className="border-b border-neutral-100 px-5 py-4">
 <h2 className="text-sm font-semibold text-neutral-900">Monthly table</h2>
 <p className="mt-0.5 text-xs text-neutral-500">Every month in the window, zeros included. The current month is month to date.</p>
 </div>
 <div className="overflow-x-auto">
 <table className="w-full min-w-[560px] text-sm">
 <thead>
 <tr className="border-b border-neutral-200 bg-neutral-50/80 text-left text-xs font-medium text-neutral-500">
 <th scope="col" className="px-5 py-2.5">Month</th>
 <th scope="col" className="px-5 py-2.5 text-right">Signups</th>
 <th scope="col" className="px-5 py-2.5 text-right">Listings posted</th>
 <th scope="col" className="px-5 py-2.5 text-right">Contracts started</th>
 <th scope="col" className="px-5 py-2.5 text-right">Volume</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-neutral-100">
 {rows.map((r) => (
 <tr key={r.month}>
 <td className="px-5 py-2.5 font-medium text-neutral-900">
 {r.label}
 {r.month === currentMonth ? <span className="ml-1.5 text-[11px] font-normal text-neutral-400">MTD</span> : null}
 </td>
 <td className="px-5 py-2.5 text-right text-neutral-700">{formatNumber(r.signups)}</td>
 <td className="px-5 py-2.5 text-right text-neutral-700">{formatNumber(r.projectsPosted)}</td>
 <td className="px-5 py-2.5 text-right text-neutral-700">{formatNumber(r.contractsStarted)}</td>
 <td className="px-5 py-2.5 text-right font-medium text-neutral-900">{formatMoney(r.volume)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </section>

 <p className="text-center text-[11px] text-neutral-400">
 Derived from GET /api/v1/admin/analytics/monthly?months=12 · zeros mean a month with no recorded activity · current month is month to date.
 </p>
 </div>
 );
}


