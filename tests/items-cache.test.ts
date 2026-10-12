import { describe, expect, it, vi } from "vitest";
import { cacheItemRequestSchema } from "@/lib/item-schemas";
import {
  getOrCreateCachedItem,
  ItemNotFoundError,
  type ItemStore,
  type StoredItem,
} from "@/server/items";
import type { NormalizedItem, Provider } from "@/server/providers/types";

function storedFrom(normalized: NormalizedItem, id = "item-1"): StoredItem {
  const now = new Date("2026-10-12T00:00:00.000Z");
  return {
    id,
    type: normalized.type,
    source: normalized.source,
    externalId: normalized.externalId,
    title: normalized.title,
    description: normalized.description ?? null,
    year: normalized.year ?? null,
    genres: normalized.genres,
    keywords: normalized.keywords,
    creators: normalized.creators,
    coverUrl: normalized.coverUrl ?? null,
    metadata: normalized.metadata ?? null,
    embedding: null,
    embeddingModel: null,
    searchTsv: null,
    createdAt: now,
    updatedAt: now,
  };
}

function memoryStore(seed: StoredItem[] = []): ItemStore {
  const rows = [...seed];
  return {
    async findBySourceExternalId(source, externalId) {
      return rows.find((row) => row.source === source && row.externalId === externalId) ?? null;
    },
    async upsert(item) {
      const existing = rows.findIndex(
        (row) => row.source === item.source && row.externalId === item.externalId,
      );
      const stored = storedFrom(item, existing >= 0 ? rows[existing].id : `item-${rows.length + 1}`);
      if (existing >= 0) {
        rows[existing] = stored;
      } else {
        rows.push(stored);
      }
      return stored;
    },
  };
}

const dune: NormalizedItem = {
  type: "book",
  source: "openlibrary",
  externalId: "OL893415W",
  title: "Dune",
  genres: ["Science fiction"],
  keywords: [],
  creators: ["Frank Herbert"],
};

describe("cacheItemRequestSchema", () => {
  it("accepts a valid TMDB movie request", () => {
    const parsed = cacheItemRequestSchema.safeParse({
      source: "tmdb",
      externalId: "157336",
      type: "movie",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects TMDB books and Open Library movies", () => {
    expect(
      cacheItemRequestSchema.safeParse({
        source: "tmdb",
        externalId: "1",
        type: "book",
      }).success,
    ).toBe(false);
    expect(
      cacheItemRequestSchema.safeParse({
        source: "openlibrary",
        externalId: "OL1W",
        type: "movie",
      }).success,
    ).toBe(false);
  });
});

describe("getOrCreateCachedItem", () => {
  it("creates one row when the same item is requested twice", async () => {
    const store = memoryStore();
    const getById = vi.fn(async () => dune);
    const getProvider = (): Provider => ({
      search: async () => [],
      getById,
    });

    const request = {
      source: "openlibrary" as const,
      externalId: "OL893415W",
      type: "book" as const,
    };

    const first = await getOrCreateCachedItem(request, store, getProvider);
    const second = await getOrCreateCachedItem(request, store, getProvider);

    expect(first.id).toBe(second.id);
    expect(getById).toHaveBeenCalledTimes(1);
    expect(await store.findBySourceExternalId("openlibrary", "OL893415W")).toEqual(first);
    expect(first.embedding).toBeNull();
  });

  it("throws when the provider has no matching item", async () => {
    const store = memoryStore();
    await expect(
      getOrCreateCachedItem(
        { source: "tmdb", externalId: "missing", type: "movie" },
        store,
        () => ({
          search: async () => [],
          getById: async () => null,
        }),
      ),
    ).rejects.toBeInstanceOf(ItemNotFoundError);
  });
});
