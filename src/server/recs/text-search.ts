import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { items, userItems } from "@/db/schema";

export type SearchHit = typeof items.$inferSelect & {
  rank: number;
};

export type SearchCachedItemsParams = {
  q: string;
  mode?: "text" | "semantic";
  type?: "all" | "movie" | "tv" | "book";
  limit?: number;
  page?: number;
  exclude_logged?: boolean;
};

/**
 * Full-text search over cached catalog items using Postgres tsvector and GIN index.
 * Matches are ranked according to weights:
 * - A (1.0): Title
 * - B (0.4): Creators (directors, authors)
 * - C (0.2): Description, genres, and keywords
 */
export async function searchCachedItemsText(
  params: SearchCachedItemsParams,
  userId?: string,
): Promise<{ items: SearchHit[]; total: number }> {
  const {
    q,
    type = "all",
    limit = 20,
    page = 1,
    exclude_logged = false,
  } = params;
  const offset = (page - 1) * limit;

  const tsQuery = sql`websearch_to_tsquery('english', ${q})`;

  const conditions = [sql`${items.searchTsv} @@ ${tsQuery}`];

  if (type && type !== "all") {
    conditions.push(sql`${items.type} = ${type}`);
  }

  if (exclude_logged && userId) {
    conditions.push(
      sql`${items.id} NOT IN (SELECT ${userItems.itemId} FROM ${userItems} WHERE ${userItems.userId} = ${userId})`,
    );
  }

  const whereClause = sql.join(conditions, sql` AND `);

  // Weights: [D=0.1, C=0.2, B=0.4, A=1.0]
  const rankExpr = sql<number>`ts_rank(ARRAY[0.1, 0.2, 0.4, 1.0]::float4[], ${items.searchTsv}, ${tsQuery})`;

  const results = await db
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
      rank: rankExpr,
    })
    .from(items)
    .where(whereClause)
    .orderBy(sql`${rankExpr} DESC`, sql`${items.year} DESC NULLS LAST`)
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(items)
    .where(whereClause);

  const total = Number(countResult[0]?.count ?? 0);

  return {
    items: results,
    total,
  };
}
