"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { ItemCard, type CardItem } from "@/components/item-card";
import type { NormalizedItem } from "@/server/providers/types";

type MediaType = "all" | "movie" | "tv" | "book";

const TYPE_TABS: Array<{ value: MediaType; label: string }> = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV Shows" },
  { value: "book", label: "Books" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<MediaType>("all");
  const [results, setResults] = useState<NormalizedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string, t: MediaType) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, type: t });
      const res = await fetch(`/api/search?${params.toString()}`);
      if (res.status === 429) {
        setError("Too many requests — please wait a moment before searching again.");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error?.message ?? "Search failed. Please try again.");
        return;
      }
      const data = await res.json() as { items: NormalizedItem[] };
      setResults(data.items);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce — fire 400ms after typing stops
  // Note: state is only set inside the timer callback (async event), not synchronously
  // in the effect body, to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!query.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }
      void doSearch(query, type);
    }, 100);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, type, doSearch]);

  const handleAdd = async (item: NormalizedItem): Promise<string> => {
    // 1. Cache the item in our DB
    const cacheRes = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: item.source,
        externalId: item.externalId,
        type: item.type,
      }),
    });
    if (!cacheRes.ok) throw new Error("Failed to cache item");
    const cached = await cacheRes.json() as { id: string };

    // 2. Add to library
    const libRes = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: cached.id, status: "planned" }),
    });
    if (!libRes.ok) throw new Error("Failed to add to library");
    return cached.id;
  };

  const cardItems: CardItem[] = results.map((item) => ({
    kind: "search",
    data: item,
  }));

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Search</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Find movies, TV shows, and books from our live catalog
          </p>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="search-input"
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search for "Dune", "Breaking Bad", "Frank Herbert"…'
            className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4 text-sm shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-ring focus:shadow-md"
          />
          {loading && (
            <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Type tabs */}
        <div className="flex rounded-xl border border-border/60 bg-muted/40 p-1 gap-1 w-fit">
          {TYPE_TABS.map(({ value, label }) => (
            <button
              key={value}
              id={`search-type-${value}`}
              type="button"
              onClick={() => setType(value)}
              className={`
                rounded-lg px-4 py-1.5 text-xs font-medium transition-all
                ${type === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"}
              `}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Results */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        {!loading && !error && query && results.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 py-16 text-center">
            <p className="text-sm font-medium">No results for &ldquo;{query}&rdquo;</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try a different keyword or switch the media type
            </p>
          </div>
        )}

        {!query && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 py-16 text-center">
            <Search className="size-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Start typing to search across movies, TV shows, and books
            </p>
          </div>
        )}

        {results.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground">
              {results.length} result{results.length !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {cardItems.map((item) => (
                <ItemCard
                  key={`${item.data.source}-${item.data.externalId}`}
                  item={item}
                  onAdd={handleAdd}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
