import { TmdbProvider } from "@/server/providers/tmdb";
import { OpenLibraryProvider } from "@/server/providers/openlibrary";
import type { NormalizedItem, ItemType } from "@/server/providers/types";
import type { SearchQuery } from "@/lib/library-schemas";

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter — good enough for MVP
// Allows 20 requests per user per 60 seconds
// ---------------------------------------------------------------------------
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= MAX_REQUESTS) return false;

  entry.count++;
  return true;
}

// ---------------------------------------------------------------------------
// Fan-out search
// ---------------------------------------------------------------------------
const tmdb = new TmdbProvider();
const openLibrary = new OpenLibraryProvider();

export async function fanOutSearch(query: SearchQuery): Promise<NormalizedItem[]> {
  const { q, type, page } = query;

  const requests: Promise<NormalizedItem[]>[] = [];

  if (type === "all" || type === "movie" || type === "tv") {
    const itemType: ItemType | undefined =
      type === "movie" ? "movie" : type === "tv" ? "tv" : undefined;
    requests.push(
      tmdb.search(q, { type: itemType, page }).catch(() => []),
    );
  }

  if (type === "all" || type === "book") {
    requests.push(
      openLibrary.search(q, { page }).catch(() => []),
    );
  }

  const results = await Promise.all(requests);
  return results.flat();
}
