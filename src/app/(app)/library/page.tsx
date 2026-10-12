"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { ItemCard, type CardItem } from "@/components/item-card";
import { LibraryFilters, type LibraryFilter } from "@/components/library-filters";
import type { ItemStatus } from "@/lib/library-schemas";
import type { NormalizedItem } from "@/server/providers/types";

type LibraryItem = {
  id: string;
  itemId: string;
  status: ItemStatus;
  rating: number | null;
  notes: string | null;
  item: {
    id: string;
    type: "movie" | "tv" | "book";
    source: "tmdb" | "openlibrary";
    externalId: string;
    title: string;
    description: string | null;
    year: number | null;
    genres: string[];
    keywords: string[];
    creators: string[];
    coverUrl: string | null;
    metadata: Record<string, unknown> | null;
  };
};

function toNormalizedItem(lib: LibraryItem): NormalizedItem {
  return {
    type: lib.item.type,
    source: lib.item.source,
    externalId: lib.item.externalId,
    title: lib.item.title,
    description: lib.item.description ?? undefined,
    year: lib.item.year ?? undefined,
    genres: lib.item.genres,
    keywords: lib.item.keywords,
    creators: lib.item.creators,
    coverUrl: lib.item.coverUrl ?? undefined,
    metadata: lib.item.metadata ?? undefined,
  };
}

const PAGE_SIZE = 20;

export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LibraryFilter>({
    sort: "updated_at",
    order: "desc",
  });

  const fetchItems = useCallback(
    async (f: LibraryFilter, p: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          sort: f.sort,
          order: f.order,
          page: String(p),
          limit: String(PAGE_SIZE),
        });
        if (f.type) params.set("type", f.type);
        if (f.status) params.set("status", f.status);

        const res = await fetch(`/api/library?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load library");
        const data = await res.json() as { items: LibraryItem[]; total: number };
        setItems(data.items);
        setTotal(data.total);
      } catch {
        setError("Failed to load your library. Please refresh.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    // Wrap in async IIFE so setState calls happen inside an async callback,
    // not synchronously in the effect body (react-hooks/set-state-in-effect).
    void (async () => {
      await fetchItems(filters, page);
    })();
  }, [filters, page, fetchItems]);

  const handleFiltersChange = (newFilters: LibraryFilter) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleStatusChange = async (dbItemId: string, status: ItemStatus) => {
    const res = await fetch(`/api/library/${dbItemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return;
    setItems((prev) =>
      prev.map((i) => (i.itemId === dbItemId ? { ...i, status } : i)),
    );
  };

  const handleRatingChange = async (dbItemId: string, rating: number | null) => {
    const res = await fetch(`/api/library/${dbItemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    });
    if (!res.ok) return;
    setItems((prev) =>
      prev.map((i) => (i.itemId === dbItemId ? { ...i, rating } : i)),
    );
  };

  const handleRemove = async (dbItemId: string) => {
    const res = await fetch(`/api/library/${dbItemId}`, { method: "DELETE" });
    if (!res.ok) return;
    setItems((prev) => prev.filter((i) => i.itemId !== dbItemId));
    setTotal((t) => t - 1);
  };

  const cardItems: CardItem[] = items.map((lib) => ({
    kind: "library",
    dbItemId: lib.itemId,
    data: toNormalizedItem(lib),
    userStatus: lib.status,
    userRating: lib.rating,
  }));

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Library</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {total} item{total !== 1 ? "s" : ""} tracked
            </p>
          </div>
          <Link
            href="/search"
            id="add-media-link"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            + Add media
          </Link>
        </div>

        {/* Filters */}
        <LibraryFilters filters={filters} onChange={handleFiltersChange} />

        {/* Content */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 py-16 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-2xl">
              📚
            </div>
            <h3 className="text-base font-semibold">
              {filters.type || filters.status ? "No matching items" : "Your library is empty"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {filters.type || filters.status
                ? "Try changing the filters"
                : "Start by searching for movies, TV shows, and books"}
            </p>
            {!filters.type && !filters.status && (
              <Link
                href="/search"
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Search Catalog
              </Link>
            )}
          </div>
        )}

        {!loading && !error && cardItems.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {cardItems.map((item) => (
                <ItemCard
                  key={item.kind === "library" ? item.dbItemId : `${item.data.source}-${item.data.externalId}`}
                  item={item}
                  onStatusChange={handleStatusChange}
                  onRatingChange={handleRatingChange}
                  onRemove={handleRemove}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  id="library-prev"
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <button
                  id="library-next"
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
