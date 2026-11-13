"use client";

import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

const AXIS = {
 tick: { fill: "#737373", fontSize: 11 },
 axisLine: false as const,
 tickLine: false as const,
};

function ChartTooltip({ active, payload, label, formatter }: any) {
 if (!active || !payload?.length) return null;
 return (
 <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-dropdown">
 <p className="text-xs font-medium text-neutral-500">{label}</p>
 {payload.map((p: any, i: number) => (
 <p key={i} className="mt-0.5 text-xs text-neutral-900">
 <span aria-hidden className="mr-1.5 inline-block size-1.5 rounded-full" style={{ background: p.color ?? p.fill }} />
 {p.name}: <span className="font-medium">{formatter ? formatter(p.value) : p.value}</span>
 </p>
 ))}
 </div>
 );
}

export function EarningsAreaChart({
 data,
 height = 240,
 className,
}: {
 data: { label: string; value: number }[];
 height?: number;
 className?: string;
}) {
 return (
 <div className={className} style={{ height }}>
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
 <XAxis dataKey="label" {...AXIS} />
 <YAxis width={56} tickFormatter={(v: number) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} {...AXIS} />
 <Tooltip content={<ChartTooltip formatter={(v: number) => `$${v.toLocaleString()}`} />} cursor={{ stroke: "#d4d4d4" }} />
 <Area
 type="monotone"
 dataKey="value"
 name="Earnings"
 stroke="var(--color-brand-600)"
 strokeWidth={2}
 fill="rgba(90, 80, 229, 0.09)"
 activeDot={{ r: 4, fill: "var(--color-brand-600)" }}
 dot={false}
 />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 );
}

export function RevenueBarChart({
 data,
 height = 240,
 className,
 dataKey = "value",
 labelFormatter,
 valueFormatter,
}: {
 data: Record<string, any>[];
 height?: number;
 className?: string;
 dataKey?: string;
 labelFormatter?: (v: string) => string;
 valueFormatter?: (v: number) => string;
}) {
 return (
 <div className={className} style={{ height }}>
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
 <XAxis dataKey="label" tickFormatter={labelFormatter} {...AXIS} />
 <YAxis width={56} {...AXIS} />
 <Tooltip content={<ChartTooltip formatter={valueFormatter} />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
 <Bar dataKey={dataKey} name="Revenue" fill="var(--color-brand-500)" radius={[6, 6, 0, 0]} maxBarSize={36} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 );
}

export function TrendLineChart({
 data,
 series,
 height = 240,
 className,
 valueFormatter,
}: {
 data: Record<string, any>[];
 series: { key: string; name: string }[];
 height?: number;
 className?: string;
 valueFormatter?: (v: number) => string;
}) {
 const colors = ["var(--color-brand-600)", "#059669", "#d97706"];
 return (
 <div className={className} style={{ height }}>
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
 <XAxis dataKey="label" {...AXIS} />
 <YAxis width={56} {...AXIS} />
 <Tooltip content={<ChartTooltip formatter={valueFormatter} />} cursor={{ stroke: "#d4d4d4" }} />
 {series.map((s, i) => (
 <Line
 key={s.key}
 type="monotone"
 dataKey={s.key}
 name={s.name}
 stroke={colors[i % colors.length]}
 strokeWidth={2}
 dot={false}
 activeDot={{ r: 4 }}
 />
 ))}
 </LineChart>
 </ResponsiveContainer>
 </div>
 );
}

const DONUT_COLORS = ["#5a50e5", "#8e88f2", "#b2aef8", "#10b981", "#f59e0b", "#e5e5e5"];

export function CategoryDonut({
 data,
 height = 240,
 className,
 centerLabel,
 centerValue,
}: {
 data: { label: string; value: number }[];
 height?: number;
 className?: string;
 centerLabel?: string;
 centerValue?: string;
}) {
 const total = data.reduce((acc, d) => acc + d.value, 0);
 return (
 <div className={cn("flex items-center gap-6", className)}>
 <div className="relative shrink-0" style={{ height, width: height }}>
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie
 data={data}
 dataKey="value"
 nameKey="label"
 innerRadius={height * 0.3}
 outerRadius={height * 0.46}
 paddingAngle={2}
 strokeWidth={0}
 >
 {data.map((_, i) => (
 <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
 ))}
 </Pie>
 <Tooltip content={<ChartTooltip />} />
 </PieChart>
 </ResponsiveContainer>
 <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
 {centerValue ? <p className="text-xl font-semibold tracking-tight text-neutral-900">{centerValue}</p> : null}
 {centerLabel ? <p className="text-[11px] text-neutral-500">{centerLabel}</p> : null}
 </div>
 </div>
 <ul className="flex min-w-0 flex-1 flex-col gap-2.5">
 {data.map((d, i) => (
 <li key={d.label} className="flex items-center gap-2.5 text-sm">
 <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
 <span className="min-w-0 flex-1 truncate text-neutral-700">{d.label}</span>
 <span className="shrink-0 font-medium text-neutral-900">{Math.round((d.value / total) * 100)}%</span>
 </li>
 ))}
 </ul>
 </div>
 );
}
