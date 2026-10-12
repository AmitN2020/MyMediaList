"use client";

import { BookOpen, Film, Tv } from "lucide-react";
import type { ItemStatus } from "@/lib/library-schemas";
import { STATUS_LABELS } from "@/components/status-select";

export type LibraryFilter = {
  type?: "movie" | "tv" | "book";
  status?: ItemStatus;
  sort: "updated_at" | "rating" | "title" | "year";
  order: "asc" | "desc";
};

interface LibraryFiltersProps {
  filters: LibraryFilter;
  onChange: (filters: LibraryFilter) => void;
  counts?: Partial<Record<ItemStatus | "all", number>>;
}

const TYPE_OPTIONS = [
  { value: undefined, label: "All", icon: null },
  { value: "movie" as const, label: "Movies", icon: Film },
  { value: "tv" as const, label: "TV Shows", icon: Tv },
  { value: "book" as const, label: "Books", icon: BookOpen },
];

const STATUS_OPTIONS: Array<{ value: ItemStatus | undefined; label: string }> = [
  { value: undefined, label: "All statuses" },
  ...(Object.keys(STATUS_LABELS) as ItemStatus[]).map((s) => ({
    value: s,
    label: STATUS_LABELS[s],
  })),
];

const SORT_OPTIONS: Array<{ value: LibraryFilter["sort"]; label: string }> = [
  { value: "updated_at", label: "Recently updated" },
  { value: "rating", label: "Rating" },
  { value: "title", label: "Title" },
  { value: "year", label: "Year" },
];

export function LibraryFilters({ filters, onChange, counts }: LibraryFiltersProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
      {/* Type tabs */}
      <div className="flex rounded-xl border border-border/60 bg-muted/40 p-1 gap-1">
        {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={label}
            id={`filter-type-${value ?? "all"}`}
            type="button"
            onClick={() => onChange({ ...filters, type: value })}
            className={`
              flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all
              ${filters.type === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"}
            `}
          >
            {Icon && <Icon className="size-3.5" />}
            {label}
          </button>
        ))}
      </div>

      {/* Status filter */}
      <select
        id="filter-status"
        value={filters.status ?? ""}
        onChange={(e) =>
          onChange({
            ...filters,
            status: (e.target.value || undefined) as ItemStatus | undefined,
          })
        }
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {STATUS_OPTIONS.map(({ value, label }) => (
          <option key={label} value={value ?? ""}>
            {label}
            {value && counts?.[value] !== undefined ? ` (${counts[value]})` : ""}
          </option>
        ))}
      </select>

      {/* Sort */}
      <div className="flex items-center gap-2 ml-auto">
        <select
          id="filter-sort"
          value={filters.sort}
          onChange={(e) =>
            onChange({ ...filters, sort: e.target.value as LibraryFilter["sort"] })
          }
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {SORT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              Sort: {label}
            </option>
          ))}
        </select>

        <button
          id="filter-order"
          type="button"
          onClick={() =>
            onChange({ ...filters, order: filters.order === "asc" ? "desc" : "asc" })
          }
          aria-label={`Sort ${filters.order === "asc" ? "descending" : "ascending"}`}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
        >
          {filters.order === "asc" ? "↑" : "↓"}
        </button>
      </div>
    </div>
  );
}
