"use client";

import { TrendLineChart } from "@/components/ui/charts";
import { formatMoney } from "@/lib/format";

/** Client boundary so the server dashboard can pass plain data without function props. */
export function VolumeTrendChart({ data }: { data: { label: string; volume: number }[] }) {
 return (
 <TrendLineChart
 data={data}
 series={[{ key: "volume", name: "Gross volume" }]}
 valueFormatter={(v: number) => formatMoney(v)}
 height={260}
 />
 );
}
