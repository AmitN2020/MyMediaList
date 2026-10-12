import { describe, expect, it, vi } from "vitest";
import { buildItemText } from "@/server/embeddings/build-text";
import { GeminiEmbeddingProvider } from "@/server/embeddings/client";

describe("Embeddings Pipeline - Task 5.1", () => {
  describe("buildItemText", () => {
    it("generates deterministic text for full item", () => {
      const item = {
        type: "movie" as const,
        title: "Inception",
        year: 2010,
        creators: ["Christopher Nolan"],
        genres: ["Action", "Sci-Fi"],
        keywords: ["dreams", "subconscious"],
        description: "A thief enters the dreams of others.",
      };

      const text1 = buildItemText(item);
      const text2 = buildItemText(item);

      expect(text1).toBe(text2);
      expect(text1).toBe(
        "Movie: Inception (2010)\nBy: Christopher Nolan\nGenres: Action, Sci-Fi\nThemes: dreams, subconscious\nA thief enters the dreams of others.",
      );
    });

    it("cleanly omits missing fields", () => {
      const item = {
        type: "book" as const,
        title: "Unknown Book",
      };

      const text = buildItemText(item);
      expect(text).toBe("Book: Unknown Book");
      expect(text).not.toContain("By:");
      expect(text).not.toContain("Genres:");
      expect(text).not.toContain("Themes:");
      expect(text).not.toContain("(");
    });

    it("formats TV media type correctly", () => {
      const item = {
        type: "tv" as const,
        title: "Breaking Bad",
        year: 2008,
      };

      const text = buildItemText(item);
      expect(text).toBe("TV: Breaking Bad (2008)");
    });

    it("truncates descriptions longer than 1500 characters", () => {
      const longDescription = "A".repeat(2000);
      const item = {
        type: "movie" as const,
        title: "Long Story",
        description: longDescription,
      };

      const text = buildItemText(item);
      expect(text.length).toBeLessThan(1600);
      expect(text.endsWith("...")).toBe(true);
    });
  });

  describe("GeminiEmbeddingProvider", () => {
    it("returns empty array when given no texts", async () => {
      const provider = new GeminiEmbeddingProvider({ apiKey: "test-key" });
      const result = await provider.embed([]);
      expect(result).toEqual([]);
    });

    it("throws if API key is missing", async () => {
      const provider = new GeminiEmbeddingProvider({ apiKey: "" });
      await expect(provider.embed(["test"])).rejects.toThrow("GEMINI_API_KEY");
    });

    it("batches requests and returns embedding vectors", async () => {
      const mockFetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            embeddings: [
              { values: new Array(768).fill(0.1) },
              { values: new Array(768).fill(0.2) },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

      const provider = new GeminiEmbeddingProvider({
        apiKey: "test-key",
        batchSize: 2,
        delayBetweenBatchesMs: 0,
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const vectors = await provider.embed(["Text A", "Text B"]);
      expect(vectors).toHaveLength(2);
      expect(vectors[0]).toHaveLength(768);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("retries on 429 rate limit errors", async () => {
      let callCount = 0;
      const mockFetch = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response("Too Many Requests", { status: 429 });
        }
        return new Response(
          JSON.stringify({
            embeddings: [{ values: new Array(768).fill(0.5) }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

      const provider = new GeminiEmbeddingProvider({
        apiKey: "test-key",
        maxRetries: 2,
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const vectors = await provider.embed(["Text with retry"]);
      expect(vectors).toHaveLength(1);
      expect(callCount).toBe(2);
    });
  });
});
