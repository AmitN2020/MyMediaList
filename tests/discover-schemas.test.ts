import { describe, expect, it } from "vitest";
import { discoverQuerySchema } from "@/lib/discover-schemas";

describe("Discover Query Validation Schema", () => {
  it("parses valid query with default parameters", () => {
    const result = discoverQuerySchema.safeParse({ q: "inception" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("inception");
      expect(result.data.mode).toBe("text");
      expect(result.data.type).toBe("all");
      expect(result.data.limit).toBe(20);
      expect(result.data.page).toBe(1);
      expect(result.data.exclude_logged).toBe(false);
    }
  });

  it("rejects empty query", () => {
    const result = discoverQuerySchema.safeParse({ q: "" });
    expect(result.success).toBe(false);
  });

  it("coerces numeric limit and page, and parses exclude_logged boolean", () => {
    const result = discoverQuerySchema.safeParse({
      q: "nolan",
      mode: "text",
      type: "movie",
      limit: "50",
      page: "2",
      exclude_logged: "true",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.page).toBe(2);
      expect(result.data.type).toBe("movie");
      expect(result.data.exclude_logged).toBe(true);
    }
  });

  it("rejects invalid mode or media type", () => {
    expect(
      discoverQuerySchema.safeParse({ q: "test", mode: "invalid" }).success,
    ).toBe(false);
    expect(
      discoverQuerySchema.safeParse({ q: "test", type: "invalid" }).success,
    ).toBe(false);
  });
});
