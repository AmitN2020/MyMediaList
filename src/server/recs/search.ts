import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { items, userItems } from "@/db/schema";
import { getEmbeddingProvider } from "@/server/embeddings/client";
import type { ItemType } from "@/server/providers/types";

export type SemanticSearchParams = {
  q: string;
  type?: "all" | ItemType;
  limit?: number;
  excludeLogged?: boolean;
};

export type SemanticSearchHit = typeof items.$inferSelect & { score: number };

const QUERY_CACHE_TTL_MS = 5 * 60 * 1000;
const QUERY_CACHE_MAX_ENTRIES = 100;
const queryCache = new Map<string, { vector: number[]; expiresAt: number }>();

export function toVectorLiteral(vector: readonly number[]): string {
  if (vector.length === 0 || vector.some((value) => !Number.isFinite(value))) {
    throw new Error("Embedding vector must contain only finite values");
  }

  return `[${vector.join(",")}]`;
}

export function groupHitsByType(hits: SemanticSearchHit[]): Record<ItemType, SemanticSearchHit[]> {
  return {
    movie: hits.filter((hit) => hit.type === "movie"),
    tv: hits.filter((hit) => hit.type === "tv"),
    book: hits.filter((hit) => hit.type === "book"),
  };
}

export async function getQueryEmbedding(query: string): Promise<number[]> {
  const cacheKey = query.trim().toLocaleLowerCase();
  const cached = queryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.vector;

  const [vector] = await getEmbeddingProvider().embed([query]);
  if (!vector) throw new Error("Embedding provider did not return a query vector");

  if (queryCache.size >= QUERY_CACHE_MAX_ENTRIES) {
    const oldestKey = queryCache.keys().next().value;
    if (oldestKey) queryCache.delete(oldestKey);
  }
  queryCache.set(cacheKey, { vector, expiresAt: Date.now() + QUERY_CACHE_TTL_MS });
  return vector;
}

async function searchOneType(
  vectorLiteral: string,
  type: ItemType | undefined,
  limit: number,
  userId: string,
  excludeLogged: boolean,
): Promise<SemanticSearchHit[]> {
  const conditions = [sql`${items.embedding} IS NOT NULL`];
  if (type) conditions.push(sql`${items.type} = ${type}`);
  if (excludeLogged) {
    conditions.push(
      sql`${items.id} NOT IN (SELECT ${userItems.itemId} FROM ${userItems} WHERE ${userItems.userId} = ${userId})`,
    );
  }

  const whereClause = sql.join(conditions, sql` AND `);
  const distance = sql`${items.embedding} <=> ${vectorLiteral}::vector`;
  const score = sql<number>`1 - (${distance})`;

  return db
    .select({
      id: items.id,
      type: items.type,
      source: items.source,
      externalId: items.externalId,
      title: items.title,
      description: items.description,
      year: items.year,
      genres: items.genres,
      keywords: items.keywords,
      creators: items.creators,
      coverUrl: items.coverUrl,
      metadata: items.metadata,
      embedding: items.embedding,
      embeddingModel: items.embeddingModel,
      searchTsv: items.searchTsv,
      createdAt: items.createdAt,
      updatedAt: items.updatedAt,
      score,
    })
    .from(items)
    .where(whereClause)
    .orderBy(distance)
    .limit(limit);
}

export async function searchCachedItemsSemantic(
  params: SemanticSearchParams,
  userId: string,
): Promise<SemanticSearchHit[]> {
  const vector = await getQueryEmbedding(params.q);
  const vectorLiteral = toVectorLiteral(vector);
  const type = params.type ?? "all";
  const limit = params.limit ?? 5;
  const excludeLogged = params.excludeLogged ?? false;

  if (type !== "all") {
    return searchOneType(vectorLiteral, type, limit, userId, excludeLogged);
  }

  const results = await Promise.all(
    (["movie", "tv", "book"] as const).map((itemType) =>
      searchOneType(vectorLiteral, itemType, limit, userId, excludeLogged),
    ),
  );
  return results.flat();
}
