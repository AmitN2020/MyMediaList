import { desc, eq, notInArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { items, userItems } from "@/db/schema";
import type { ItemStatus } from "@/lib/library-schemas";
import { toVectorLiteral, type SemanticSearchHit } from "@/server/recs/search";
import { selectRecentActivities, type RecentActivityInput } from "@/server/recs/recent-activity";
import { buildTasteVector, type TasteVectorInput } from "@/server/recs/taste-vector";
import type { ItemType } from "@/server/providers/types";

export type RecommendationResult = SemanticSearchHit & { reason: "taste" | "popular" };
export type RecentRecommendation = SemanticSearchHit & { becauseOf: { itemId: string; title: string } };

export function applyGenreDiversity<T extends { genres: string[] }>(candidates: T[], limit: number, cap = 2): T[] {
  const counts = new Map<string, number>();
  const selected: T[] = [];
  for (const candidate of candidates) {
    const genre = candidate.genres[0]?.toLocaleLowerCase();
    if (genre && (counts.get(genre) ?? 0) >= cap) continue;
    selected.push(candidate);
    if (genre) counts.set(genre, (counts.get(genre) ?? 0) + 1);
    if (selected.length === limit) break;
  }
  return selected;
}

async function nearestItems(vector: number[], userId: string, limit: number, type?: ItemType, excludeIds: string[] = []): Promise<SemanticSearchHit[]> {
  const vectorLiteral = toVectorLiteral(vector);
  const conditions = [sql`${items.embedding} IS NOT NULL`, sql`${items.id} NOT IN (SELECT ${userItems.itemId} FROM ${userItems} WHERE ${userItems.userId} = ${userId})`];
  if (type) conditions.push(eq(items.type, type));
  if (excludeIds.length > 0) conditions.push(notInArray(items.id, excludeIds));
  const distance = sql`${items.embedding} <=> ${vectorLiteral}::vector`;
  const score = sql<number>`1 - (${distance})`;
  return db.select({ id: items.id, type: items.type, source: items.source, externalId: items.externalId, title: items.title, description: items.description, year: items.year, genres: items.genres, keywords: items.keywords, creators: items.creators, coverUrl: items.coverUrl, metadata: items.metadata, embedding: items.embedding, embeddingModel: items.embeddingModel, searchTsv: items.searchTsv, createdAt: items.createdAt, updatedAt: items.updatedAt, score })
    .from(items).where(sql.join(conditions, sql` AND `)).orderBy(distance).limit(limit);
}

async function getTasteInputs(userId: string): Promise<TasteVectorInput[]> {
  const rows = await db.query.userItems.findMany({ where: eq(userItems.userId, userId), with: { item: true } });
  return rows.flatMap((row) => row.item.embedding ? [{ embedding: row.item.embedding, rating: row.rating, status: row.status, completedAt: row.completedAt, updatedAt: row.updatedAt }] : []);
}

async function popularItems(userId: string, type: "all" | ItemType, limit: number): Promise<SemanticSearchHit[]> {
  const conditions = [sql`${items.embedding} IS NOT NULL`, sql`${items.id} NOT IN (SELECT ${userItems.itemId} FROM ${userItems} WHERE ${userItems.userId} = ${userId})`];
  if (type !== "all") conditions.push(eq(items.type, type));
  return db.select({ id: items.id, type: items.type, source: items.source, externalId: items.externalId, title: items.title, description: items.description, year: items.year, genres: items.genres, keywords: items.keywords, creators: items.creators, coverUrl: items.coverUrl, metadata: items.metadata, embedding: items.embedding, embeddingModel: items.embeddingModel, searchTsv: items.searchTsv, createdAt: items.createdAt, updatedAt: items.updatedAt, score: sql<number>`0` })
    .from(items).where(sql.join(conditions, sql` AND `)).orderBy(desc(items.createdAt)).limit(limit * 4);
}

export async function getRecommendations(userId: string, type: "all" | ItemType = "all", limit = 12): Promise<{ items: RecommendationResult[]; coldStart: boolean }> {
  const inputs = await getTasteInputs(userId);
  const ratedCount = inputs.filter((entry) => entry.rating !== null).length;
  const taste = buildTasteVector(inputs);
  if (!taste || ratedCount < 3) {
    const candidates = await popularItems(userId, type, limit);
    return { items: applyGenreDiversity(candidates, limit).map((item) => ({ ...item, reason: "popular" })), coldStart: true };
  }
  const candidates = await nearestItems(taste, userId, limit * 4, type === "all" ? undefined : type);
  return { items: applyGenreDiversity(candidates, limit).map((item) => ({ ...item, reason: "taste" })), coldStart: false };
}

export async function getRecentRecommendations(userId: string, limit = 6): Promise<Record<ItemType, RecentRecommendation[]>> {
  const rows = await db.query.userItems.findMany({ where: eq(userItems.userId, userId), with: { item: true } });
  const activity: RecentActivityInput[] = rows.map((row) => ({ itemId: row.itemId, type: row.item.type, title: row.item.title, status: row.status as ItemStatus, rating: row.rating, completedAt: row.completedAt, updatedAt: row.updatedAt, embedding: row.item.embedding }));
  const anchors = selectRecentActivities(activity);
  const types: ItemType[] = ["movie", "tv", "book"];
  const result = {} as Record<ItemType, RecentRecommendation[]>;
  for (const type of types) {
    const recommendations: RecentRecommendation[] = [];
    const seen = new Set<string>();
    for (const anchor of anchors[type]) {
      const nearby = await nearestItems(anchor.embedding!, userId, limit, type, [anchor.itemId]);
      for (const item of nearby) {
        if (!seen.has(item.id) && recommendations.length < limit) {
          seen.add(item.id);
          recommendations.push({ ...item, becauseOf: { itemId: anchor.itemId, title: anchor.title } });
        }
      }
    }
    result[type] = recommendations;
  }
  return result;
}

export async function getSimilarItems(itemId: string, userId: string, limit = 6): Promise<SemanticSearchHit[] | null> {
  const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
  if (!item?.embedding) return item ? [] : null;
  return nearestItems(item.embedding, userId, limit, undefined, [item.id]);
}
