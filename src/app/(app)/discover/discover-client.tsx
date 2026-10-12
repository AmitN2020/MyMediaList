"use client";

import { useState } from "react";
import { Loader2, Search, Sparkles } from "lucide-react";
import { ItemCard, type CardItem } from "@/components/item-card";
import { semanticDiscoverResponseSchema, type SemanticDiscoverResponse } from "@/lib/discover-response";
import type { NormalizedItem } from "@/server/providers/types";

type MediaType = "all" | "movie" | "tv" | "book";
const TYPES: Array<{ value: MediaType; label: string }> = [
  { value: "all", label: "All media" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV shows" },
  { value: "book", label: "Books" },
];
const TASTE_OPTIONS = [
  { value: 0, label: "Query only" },
  { value: 0.3, label: "30% my taste" },
  { value: 0.6, label: "60% my taste" },
];

function asNormalizedItem(item: SemanticDiscoverResponse["items"][number]): NormalizedItem {
  return {
    type: item.type,
    source: item.source,
    externalId: item.externalId,
    title: item.title,
    description: item.description ?? undefined,
    year: item.year ?? undefined,
    genres: item.genres,
    keywords: item.keywords,
    creators: item.creators,
    coverUrl: item.coverUrl ?? undefined,
  };
}

export function DiscoverClient() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<MediaType>("all");
  const [excludeLogged, setExcludeLogged] = useState(true);
  const [tasteInfluence, setTasteInfluence] = useState(0.3);
  const [results, setResults] = useState<SemanticDiscoverResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        q: query.trim(),
        type,
        limit: "5",
        taste: String(tasteInfluence),
        exclude_logged: String(excludeLogged),
      });
      const response = await fetch(`/api/recommendations?${params}`);
      const json: unknown = await response.json();
      if (!response.ok) {
        const message = typeof json === "object" && json !== null && "error" in json
          ? String((json as { error?: { message?: unknown } }).error?.message ?? "Search failed.")
          : "Search failed.";
        setError(message);
        return;
      }
      const parsed = semanticDiscoverResponseSchema.safeParse(json);
      if (!parsed.success) {
        setError("The server returned an invalid search response.");
        return;
      }
      setResults(parsed.data);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const addToLibrary = async (item: NormalizedItem): Promise<string> => {
    const cachedItem = results?.items.find(
      (result) => result.source === item.source && result.externalId === item.externalId,
    );
    if (!cachedItem) throw new Error("Could not find the selected catalog item");

    const response = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: cachedItem.id, status: "planned" }),
    });
    if (!response.ok) throw new Error("Failed to add item to library");
    return cachedItem.id;
  };

  const sections = type === "all"
    ? (["movie", "tv", "book"] as const).map((itemType) => ({ type: itemType, items: results?.groups[itemType] ?? [] }))
    : [{ type, items: results?.items ?? [] }];

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2">
          <Sparkles className="size-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Discover</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Describe a mood, theme, or story you want. We&apos;ll search the cached catalog by meaning.</p>
      </div>

      <form onSubmit={search} className="mt-7 space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input id="discover-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try: cozy mystery with a clever detective" className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-28 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <button type="submit" disabled={loading || !query.trim()} className="absolute right-1.5 top-1.5 inline-flex h-9 items-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-60">
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Discover"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {TYPES.map(({ value, label }) => <button key={value} type="button" onClick={() => setType(value)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${type === value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
          <label className="ml-1 flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={excludeLogged} onChange={(event) => setExcludeLogged(event.target.checked)} /> Hide library items</label>
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted-foreground">Influence of my taste</legend>
          <div className="flex flex-wrap gap-2">
            {TASTE_OPTIONS.map(({ value, label }) => <button key={value} type="button" onClick={() => setTasteInfluence(value)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${tasteInfluence === value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
          </div>
        </fieldset>
      </form>

      {error && <div role="alert" className="mt-6 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
      {!results && !loading && !error && <div className="mt-10 rounded-2xl border border-dashed border-border/80 px-6 py-16 text-center text-sm text-muted-foreground">Try an idea such as “hopeful space exploration” or “quiet literary story about family.”</div>}
      {results && <div className="mt-8 space-y-10">{sections.map((section) => {
        const cards: CardItem[] = section.items.map((item) => ({ kind: "search", data: asNormalizedItem(item) }));
        const labels = { movie: "Movies", tv: "TV shows", book: "Books" };
        return <section key={section.type}><h2 className="mb-4 text-xl font-semibold">{labels[section.type]}</h2>{cards.length === 0 ? <p className="text-sm text-muted-foreground">No matches in this part of the catalog.</p> : <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{cards.map((card) => <ItemCard key={`${card.data.source}-${card.data.externalId}`} item={card} onAdd={addToLibrary} />)}</div>}</section>;
      })}</div>}
    </div>
  );
}
