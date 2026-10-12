process.loadEnvFile?.();

import bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { items, userItems, users } from "../src/db/schema";
import { buildItemText } from "../src/server/embeddings/build-text";
import { getEmbeddingProvider } from "../src/server/embeddings/client";
import { TmdbProvider } from "../src/server/providers/tmdb";
import type { NormalizedItem } from "../src/server/providers/types";

const TMDB_API_KEY = process.env.TMDB_API_KEY;

interface OpenLibrarySubjectDoc {
  key: string;
  title: string;
  authors?: Array<{ name: string }>;
  first_publish_year?: number;
  cover_id?: number;
  subject?: string[];
}

interface OpenLibrarySubjectResponse {
  works?: OpenLibrarySubjectDoc[];
}

async function fetchOpenLibrarySubject(
  subject: string,
  limit = 25,
): Promise<NormalizedItem[]> {
  try {
    const res = await fetch(
      `https://openlibrary.org/subjects/${subject}.json?limit=${limit}`,
      {
        headers: { "User-Agent": "MyMediaList/0.1 (local hobby project)" },
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as OpenLibrarySubjectResponse;
    const works = data.works || [];

    return works.map((w) => {
      const externalId = w.key.replace("/works/", "");
      const subjects = w.subject || [];
      return {
        type: "book" as const,
        source: "openlibrary" as const,
        externalId,
        title: w.title,
        year: w.first_publish_year,
        creators: w.authors?.map((a) => a.name).filter(Boolean) || [],
        genres: subjects.slice(0, 5),
        keywords: subjects.slice(5, 15),
        coverUrl: w.cover_id
          ? `https://covers.openlibrary.org/b/id/${w.cover_id}-L.jpg`
          : undefined,
        metadata: {},
      };
    });
  } catch (err) {
    console.error(`Failed to fetch Open Library subject ${subject}:`, err);
    return [];
  }
}

async function fetchTmdbList(
  endpoint: string,
  type: "movie" | "tv",
  pages = 3,
): Promise<Array<{ id: number }>> {
  if (!TMDB_API_KEY) {
    console.warn("TMDB_API_KEY missing, skipping TMDB list fetch");
    return [];
  }

  const results: Array<{ id: number }> = [];
  for (let page = 1; page <= pages; page++) {
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_API_KEY}&page=${page}`,
      );
      if (!res.ok) break;
      const data = (await res.json()) as { results?: Array<{ id: number }> };
      if (data.results) {
        results.push(...data.results);
      }
    } catch {
      break;
    }
  }
  return results;
}

async function main() {
  console.log("=========================================");
  console.log("   MyMediaList: Catalog & User Seeder   ");
  console.log("=========================================\n");

  const tmdb = new TmdbProvider();
  const allItems: NormalizedItem[] = [];

  // 1. Fetch TMDB Movies (Popular & Top Rated)
  console.log("1. Fetching popular & top-rated movies from TMDB...");
  const popularMovieIds = await fetchTmdbList("movie/popular", "movie", 3);
  const topMovieIds = await fetchTmdbList("movie/top_rated", "movie", 2);
  const uniqueMovieIds = Array.from(
    new Set([...popularMovieIds, ...topMovieIds].map((m) => m.id)),
  ).slice(0, 80);

  console.log(`   Fetching details for ${uniqueMovieIds.length} movies...`);
  for (let i = 0; i < uniqueMovieIds.length; i++) {
    const id = uniqueMovieIds[i];
    try {
      const details = await tmdb.getById(String(id), "movie");
      if (details) allItems.push(details);
    } catch {}
    if (i % 20 === 0 && i > 0) {
      console.log(`   - Processed ${i}/${uniqueMovieIds.length} movies...`);
    }
  }

  // 2. Fetch TMDB TV Shows (Popular & Top Rated)
  console.log("\n2. Fetching popular & top-rated TV shows from TMDB...");
  const popularTvIds = await fetchTmdbList("tv/popular", "tv", 3);
  const topTvIds = await fetchTmdbList("tv/top_rated", "tv", 2);
  const uniqueTvIds = Array.from(
    new Set([...popularTvIds, ...topTvIds].map((t) => t.id)),
  ).slice(0, 80);

  console.log(`   Fetching details for ${uniqueTvIds.length} TV shows...`);
  for (let i = 0; i < uniqueTvIds.length; i++) {
    const id = uniqueTvIds[i];
    try {
      const details = await tmdb.getById(String(id), "tv");
      if (details) allItems.push(details);
    } catch {}
    if (i % 20 === 0 && i > 0) {
      console.log(`   - Processed ${i}/${uniqueTvIds.length} TV shows...`);
    }
  }

  // 3. Fetch Books from Open Library across genres
  console.log("\n3. Fetching curated books from Open Library...");
  const subjects = [
    "science_fiction",
    "fantasy",
    "mystery",
    "classic_literature",
    "history",
  ];

  for (const subject of subjects) {
    console.log(`   - Fetching subject: ${subject}...`);
    const books = await fetchOpenLibrarySubject(subject, 25);
    allItems.push(...books);
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nTotal items collected to seed: ${allItems.length}`);

  // 4. Upsert into database
  console.log("\n4. Upserting items into PostgreSQL database...");
  let upsertedCount = 0;

  for (const item of allItems) {
    await db
      .insert(items)
      .values({
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
      })
      .onConflictDoUpdate({
        target: [items.source, items.externalId],
        set: {
          title: item.title,
          description: item.description,
          year: item.year,
          genres: item.genres,
          keywords: item.keywords,
          creators: item.creators,
          coverUrl: item.coverUrl,
          updatedAt: new Date(),
        },
      });
    upsertedCount++;
  }
  console.log(`   Successfully upserted ${upsertedCount} items.`);

  // 5. Generate and backfill embeddings
  console.log("\n5. Generating vector embeddings with Google Gemini...");
  const provider = getEmbeddingProvider();
  const pendingItems = await db.query.items.findMany({
    where: sql`${items.embedding} IS NULL`,
  });

  console.log(`   Items pending embedding: ${pendingItems.length}`);

  if (pendingItems.length > 0) {
    const BATCH_SIZE = 50;
    for (let i = 0; i < pendingItems.length; i += BATCH_SIZE) {
      const batch = pendingItems.slice(i, i + BATCH_SIZE);
      console.log(
        `   Embedding batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} items)...`,
      );
      const texts = batch.map((item) => buildItemText(item));
      const vectors = await provider.embed(texts);

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const vector = vectors[j];
        if (item && vector) {
          await db
            .update(items)
            .set({
              embedding: vector,
              embeddingModel: provider.model,
              updatedAt: new Date(),
            })
            .where(eq(items.id, item.id));
        }
      }

      if (i + BATCH_SIZE < pendingItems.length) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }

  // 6. Create Demo User & Ratings
  console.log("\n6. Creating Demo User & Library activity...");
  const demoEmail = "demo@example.com";
  let demoUser = await db.query.users.findFirst({
    where: eq(users.email, demoEmail),
  });

  if (!demoUser) {
    const hashedPassword = await bcrypt.hash("password123", 10);
    const [created] = await db
      .insert(users)
      .values({
        name: "Demo User",
        email: demoEmail,
        password: hashedPassword,
      })
      .returning();
    demoUser = created;
    console.log(`   Created demo user: ${demoEmail} (password: password123)`);
  } else {
    console.log(`   Found existing demo user: ${demoEmail}`);
  }

  // Pick ~10 movies, ~10 tv shows, ~10 books
  const seededMovies = await db.query.items.findMany({
    where: and(eq(items.type, "movie"), sql`${items.embedding} IS NOT NULL`),
    limit: 10,
  });
  const seededTv = await db.query.items.findMany({
    where: and(eq(items.type, "tv"), sql`${items.embedding} IS NOT NULL`),
    limit: 10,
  });
  const seededBooks = await db.query.items.findMany({
    where: and(eq(items.type, "book"), sql`${items.embedding} IS NOT NULL`),
    limit: 10,
  });

  const sampleItems = [
    ...seededMovies.map((m, idx) => ({
      item: m,
      rating: ((idx % 3) + 3) as number, // 3, 4, 5
      status: (idx % 2 === 0 ? "completed" : "in_progress") as
        | "completed"
        | "in_progress",
    })),
    ...seededTv.map((t, idx) => ({
      item: t,
      rating: ((idx % 3) + 3) as number,
      status: (idx % 2 === 0 ? "completed" : "in_progress") as
        | "completed"
        | "in_progress",
    })),
    ...seededBooks.map((b, idx) => ({
      item: b,
      rating: ((idx % 3) + 3) as number,
      status: (idx % 2 === 0 ? "completed" : "in_progress") as
        | "completed"
        | "in_progress",
    })),
  ];

  let addedUserItems = 0;
  for (const { item, rating, status } of sampleItems) {
    const now = new Date();
    await db
      .insert(userItems)
      .values({
        userId: demoUser.id,
        itemId: item.id,
        status,
        rating,
        notes: `Sample review for ${item.title}`,
        startedAt: now,
        completedAt: status === "completed" ? now : null,
      })
      .onConflictDoNothing();
    addedUserItems++;
  }
  console.log(`   Added ${addedUserItems} rated items to demo user's library.`);

  // 7. Verify counts
  const [totalItemsRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(items);
  const [totalEmbeddedRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(items)
    .where(sql`${items.embedding} IS NOT NULL`);
  const [userItemsRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userItems)
    .where(eq(userItems.userId, demoUser.id));

  console.log("\n=========================================");
  console.log("   Seed Summary:                         ");
  console.log(`   - Total catalog items: ${totalItemsRow?.count}`);
  console.log(`   - Items with embeddings: ${totalEmbeddedRow?.count}`);
  console.log(`   - Demo user library items: ${userItemsRow?.count}`);
  console.log("=========================================\n");
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
