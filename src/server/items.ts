import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { items } from "@/db/schema";
import type { CacheItemRequest } from "@/lib/item-schemas";
import { OpenLibraryProvider } from "@/server/providers/openlibrary";
import { TmdbProvider } from "@/server/providers/tmdb";
import type { ItemSource, NormalizedItem, Provider } from "@/server/providers/types";

export type StoredItem = typeof items.$inferSelect;

export class ItemNotFoundError extends Error {
  constructor(source: ItemSource, externalId: string) {
    super(`No ${source} item found for ${externalId}`);
    this.name = "ItemNotFoundError";
  }
}

export type ItemStore = {
  findBySourceExternalId(
    source: ItemSource,
    externalId: string,
  ): Promise<StoredItem | null>;
  upsert(item: NormalizedItem): Promise<StoredItem>;
};

export type ProviderFactory = (source: ItemSource) => Provider;

function toInsertValues(item: NormalizedItem) {
  return {
    type: item.type,
    source: item.source,
    externalId: item.externalId,
    title: item.title,
    description: item.description,
    year: item.year,
    genres: item.genres,
    keywords: item.keywords,
    creators: item.creators,
    coverUrl: item.coverUrl,
    metadata: item.metadata,
    embedding: null,
    embeddingModel: null,
  };
}

export async function upsertItem(item: NormalizedItem): Promise<StoredItem> {
  const values = toInsertValues(item);
  const [row] = await db
    .insert(items)
    .values(values)
    .onConflictDoUpdate({
      target: [items.source, items.externalId],
      set: {
        type: values.type,
        title: values.title,
        description: values.description,
        year: values.year,
        genres: values.genres,
        keywords: values.keywords,
        creators: values.creators,
        coverUrl: values.coverUrl,
        metadata: values.metadata,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!row) {
    throw new Error("Failed to upsert item");
  }

  return row;
}

export async function findCachedItem(
  source: ItemSource,
  externalId: string,
): Promise<StoredItem | null> {
  const row = await db.query.items.findFirst({
    where: and(eq(items.source, source), eq(items.externalId, externalId)),
  });
  return row ?? null;
}

export const dbItemStore: ItemStore = {
  findBySourceExternalId: findCachedItem,
  upsert: upsertItem,
};

export function defaultProviderFactory(source: ItemSource): Provider {
  if (source === "tmdb") return new TmdbProvider();
  return new OpenLibraryProvider();
}

export async function getOrCreateCachedItem(
  request: CacheItemRequest,
  store: ItemStore = dbItemStore,
  getProvider: ProviderFactory = defaultProviderFactory,
): Promise<StoredItem> {
  const cached = await store.findBySourceExternalId(
    request.source,
    request.externalId,
  );
  if (cached) return cached;

  const normalized = await getProvider(request.source).getById(
    request.externalId,
    request.type,
  );
  if (!normalized) {
    throw new ItemNotFoundError(request.source, request.externalId);
  }

  return store.upsert(normalized);
}
