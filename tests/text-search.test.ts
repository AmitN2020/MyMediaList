import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { db } from "@/db/client";
import { items } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { searchCachedItemsText } from "@/server/recs/text-search";

describe("Full-Text Search over Cached Items (PostgreSQL tsvector)", () => {
  const testIds: string[] = [];

  beforeAll(async () => {
    // Insert test items
    // Item 1: "Arrival" - title match for "arrival", creator "Denis Villeneuve"
    // Item 2: "Contact" - description match for "arrival"
    const [item1] = await db
      .insert(items)
      .values({
        type: "movie",
        source: "tmdb",
        externalId: "test-fts-arrival",
        title: "Arrival",
        creators: ["Denis Villeneuve"],
        description: "A linguist works with the military to communicate with alien lifeforms.",
        genres: ["Drama", "Science Fiction"],
        keywords: ["linguist", "aliens"],
      })
      .returning();

    const [item2] = await db
      .insert(items)
      .values({
        type: "movie",
        source: "tmdb",
        externalId: "test-fts-contact",
        title: "Contact",
        creators: ["Robert Zemeckis"],
        description: "Dr. Ellie Arroway finds radio proof of extraterrestrial intelligence and prepares for the arrival of aliens.",
        genres: ["Drama", "Science Fiction"],
        keywords: ["astronomer", "seti"],
      })
      .returning();

    testIds.push(item1.id, item2.id);
  });

  afterAll(async () => {
    if (testIds.length > 0) {
      await db.delete(items).where(inArray(items.id, testIds));
    }
  });

  it("finds works when querying for a creator name", async () => {
    const result = await searchCachedItemsText({
      mode: "text",
      q: "Villeneuve",
      type: "all",
      limit: 10,
      page: 1,
    });

    const found = result.items.find((i) => i.externalId === "test-fts-arrival");
    expect(found).toBeDefined();
    expect(found?.title).toBe("Arrival");
    expect(found?.creators).toContain("Denis Villeneuve");
  });

  it("ranks title matches above description matches", async () => {
    const result = await searchCachedItemsText({
      mode: "text",
      q: "arrival",
      type: "all",
      limit: 10,
      page: 1,
    });

    const arrivalIndex = result.items.findIndex(
      (i) => i.externalId === "test-fts-arrival",
    );
    const contactIndex = result.items.findIndex(
      (i) => i.externalId === "test-fts-contact",
    );

    expect(arrivalIndex).toBeGreaterThanOrEqual(0);
    expect(contactIndex).toBeGreaterThanOrEqual(0);

    // Title match ("Arrival") must rank above description match ("Contact")
    expect(arrivalIndex).toBeLessThan(contactIndex);
    expect(result.items[arrivalIndex].rank).toBeGreaterThan(
      result.items[contactIndex].rank,
    );
  });

  it("filters search results by media type", async () => {
    const bookResult = await searchCachedItemsText({
      mode: "text",
      q: "arrival",
      type: "book",
      limit: 10,
      page: 1,
    });

    const foundMovie = bookResult.items.find(
      (i) => i.externalId === "test-fts-arrival",
    );
    expect(foundMovie).toBeUndefined();
  });
});
