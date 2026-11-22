"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TableShell, Table, THead, TH, TD, TR } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Icon, Search01Icon } from "@/lib/icons";

interface Column<TData> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  cell: (row: TData) => ReactNode;
}

interface DataTableProps<TData> {
  columns: Column<TData>[];
  data: TData[];
  pageSize?: number;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: ReactNode;
  rowActions?: (row: TData) => ReactNode;
  showPagination?: boolean;
  className?: string;
}

export function DataTable<TData>({
  columns,
  data,
  pageSize = 10,
  emptyTitle,
  emptyDescription,
  emptyAction,
  rowActions,
  showPagination = true,
  className,
}: DataTableProps<TData>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [pageIndex, setPageIndex] = useState(0);

  const sortableColumns = columns.filter((c) => c.sortable !== false);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      if (av === bv) return 0;
      const cmp = av < bv ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const pageData = sortedData.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const hasData = pageData.length > 0;

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey]);

  return (
    <div className={cn("w-full", className)}>
      {hasData ? (
        <>
          <TableShell className="mb-4">
            <Table>
              <THead>
                <tr>
                  {columns.map((col) => (
                    <TH
                      key={col.key}
                      align={col.align}
                      onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
                      sort={sortKey === col.key ? (sortDir === "asc" ? "asc" : "desc") : null}
                    >
                      {col.header}
                    </TH>
                  ))}
                  {rowActions ? <TH width="64" align="center">Actions</TH> : null}
                </tr>
              </THead>
              <tbody>
                {pageData.map((row, i) => (
                  <TR key={i} className="last:border-b-0">
                    {columns.map((col) => (
                      <TD key={col.key} align={col.align}>
                        {col.cell(row)}
                      </TD>
                    ))}
                    {rowActions ? (
                      <TD align="center" className="whitespace-nowrap">
                        {rowActions(row)}
                      </TD>
                    ) : null}
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableShell>

          {showPagination && totalPages > 1 && (
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-neutral-500">
                Showing {pageIndex * pageSize + 1} to {Math.min((pageIndex + 1) * pageSize, sortedData.length)} of {sortedData.length}
              </p>
              <div className="flex items-center gap-1">
                {pageIndex > 0 ? (
                  <button
                    type="button"
                    onClick={() => setPageIndex((p) => p - 1)}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
                  >
                    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
                      <path d="M10 3.5L5.5 8L10 12.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="sr-only">Previous page</span>
                  </button>
                ) : null}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPageIndex(p - 1)}
                    className={cn(
                      "inline-flex size-8 items-center justify-center rounded-lg text-sm transition-colors",
                      p - 1 === pageIndex ? "bg-brand-600 font-medium text-white" : "text-neutral-700 hover:bg-neutral-100",
                    )}
                  >
                    {p}
                  </button>
                ))}
                {pageIndex < totalPages - 1 ? (
                  <button
                    type="button"
                    onClick={() => setPageIndex((p) => p + 1)}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
                  >
                    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
                      <path d="M6 3.5L10.5 8L6 12.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="sr-only">Next page</span>
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={<Icon icon={Search01Icon} size={22} strokeWidth={1.8} />}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      )}
    </div>
  );
}
