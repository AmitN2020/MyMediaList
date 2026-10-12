import { describe, expect, it } from "vitest";
import {
  addToLibrarySchema,
  updateLibrarySchema,
  libraryQuerySchema,
  searchQuerySchema,
} from "@/lib/library-schemas";

describe("Library & Search Zod Schemas", () => {
  describe("addToLibrarySchema", () => {
    it("validates valid input with defaults", () => {
      const parsed = addToLibrarySchema.parse({
        itemId: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(parsed.status).toBe("planned");
      expect(parsed.itemId).toBe("123e4567-e89b-12d3-a456-426614174000");
      expect(parsed.rating).toBeUndefined();
    });

    it("rejects invalid UUIDs", () => {
      expect(() =>
        addToLibrarySchema.parse({
          itemId: "not-a-uuid",
        }),
      ).toThrow();
    });

    it("rejects ratings out of bounds", () => {
      expect(() =>
        addToLibrarySchema.parse({
          itemId: "123e4567-e89b-12d3-a456-426614174000",
          rating: 6,
        }),
      ).toThrow();

      expect(() =>
        addToLibrarySchema.parse({
          itemId: "123e4567-e89b-12d3-a456-426614174000",
          rating: 0,
        }),
      ).toThrow();
    });
  });

  describe("updateLibrarySchema", () => {
    it("accepts partial updates", () => {
      const parsed = updateLibrarySchema.parse({
        status: "completed",
        rating: 5,
      });
      expect(parsed.status).toBe("completed");
      expect(parsed.rating).toBe(5);
    });

    it("rejects empty update payload", () => {
      expect(() => updateLibrarySchema.parse({})).toThrow(
        "At least one field must be provided",
      );
    });

    it("allows nullable rating and notes", () => {
      const parsed = updateLibrarySchema.parse({
        rating: null,
        notes: null,
      });
      expect(parsed.rating).toBeNull();
      expect(parsed.notes).toBeNull();
    });
  });

  describe("libraryQuerySchema", () => {
    it("applies defaults for pagination and sort", () => {
      const parsed = libraryQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.sort).toBe("updated_at");
      expect(parsed.order).toBe("desc");
    });

    it("coerces string page and limit parameters", () => {
      const parsed = libraryQuerySchema.parse({
        page: "3",
        limit: "50",
        type: "movie",
        status: "in_progress",
      });
      expect(parsed.page).toBe(3);
      expect(parsed.limit).toBe(50);
      expect(parsed.type).toBe("movie");
      expect(parsed.status).toBe("in_progress");
    });
  });

  describe("searchQuerySchema", () => {
    it("requires non-empty query", () => {
      expect(() => searchQuerySchema.parse({ q: "" })).toThrow();
      const parsed = searchQuerySchema.parse({ q: "Inception" });
      expect(parsed.q).toBe("Inception");
      expect(parsed.type).toBe("all");
    });
  });
});
