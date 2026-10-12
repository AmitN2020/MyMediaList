import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { OpenLibraryProvider, normalizeOpenLibrarySearchDoc, normalizeOpenLibraryWork, parseOpenLibraryDescription } from "@/server/providers/openlibrary";
import {
  TmdbProvider,
  buildTmdbPosterUrl,
  normalizeTmdbMovieDetails,
  normalizeTmdbSearchResult,
  normalizeTmdbTvDetails,
} from "@/server/providers/tmdb";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));
}

describe("TMDB normalization", () => {
  it("normalizes a recorded movie details response", () => {
    const item = normalizeTmdbMovieDetails(loadFixture("tmdb-movie-details.json"));

    expect(item).toMatchObject({
      type: "movie",
      source: "tmdb",
      externalId: "157336",
      title: "Interstellar",
      year: 2014,
      genres: ["Adventure", "Drama", "Science Fiction"],
      keywords: ["based on novel or play", "space travel", "dystopia"],
      creators: ["Christopher Nolan"],
      coverUrl: "https://image.tmdb.org/t/p/w500/gEU2QniL6L9a1Y3KsPPxtZfaapG.jpg",
      metadata: { runtime: 169 },
    });
    expect(item?.description).toContain("wormhole");
  });

  it("normalizes a recorded TV details response", () => {
    const item = normalizeTmdbTvDetails(loadFixture("tmdb-tv-details.json"));

    expect(item).toMatchObject({
      type: "tv",
      source: "tmdb",
      externalId: "1396",
      title: "Breaking Bad",
      year: 2008,
      genres: ["Drama", "Crime"],
      creators: ["Vince Gilligan", "Michelle MacLaren"],
      metadata: { seasons: 5, episodes: 62 },
    });
    expect(item?.keywords).toContain("chemistry");
  });

  it("filters people out of multi-search results", () => {
    const payload = loadFixture("tmdb-multi-search.json") as {
      results: unknown[];
    };
    const items = payload.results
      .map((result) => normalizeTmdbSearchResult(result))
      .filter((item) => item !== null);

    expect(items.map((item) => item.type)).toEqual(["movie", "tv"]);
    expect(items[0]?.title).toBe("Interstellar");
    expect(items[1]?.title).toBe("Game of Thrones");
  });

  it("builds poster URLs from TMDB image config", () => {
    expect(buildTmdbPosterUrl("/abc.jpg", "https://image.tmdb.org/t/p/")).toBe(
      "https://image.tmdb.org/t/p/w500/abc.jpg",
    );
    expect(buildTmdbPosterUrl(null)).toBeUndefined();
  });

  it("searches via the multi-search endpoint and skips books", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/configuration")) {
        return Response.json({
          images: { secure_base_url: "https://image.tmdb.org/t/p/" },
        });
      }
      expect(url).toContain("/search/multi");
      return Response.json(loadFixture("tmdb-multi-search.json"));
    });

    const provider = new TmdbProvider({ apiKey: "test-key", fetch: fetchMock });
    const results = await provider.search("interstellar");
    expect(results).toHaveLength(2);
    expect(await provider.search("dune", { type: "book" })).toEqual([]);
  });
});

describe("Open Library normalization", () => {
  it("normalizes a recorded search document at the work level", () => {
    const payload = loadFixture("openlibrary-search.json") as { docs: unknown[] };
    const item = normalizeOpenLibrarySearchDoc(payload.docs[0]);

    expect(item).toMatchObject({
      type: "book",
      source: "openlibrary",
      externalId: "OL893415W",
      title: "Dune",
      year: 1965,
      creators: ["Frank Herbert"],
      coverUrl: "https://covers.openlibrary.org/b/id/9255906-L.jpg",
      genres: [
        "Science fiction",
        "Dune (Imaginary place)",
        "Fiction",
        "Life on other planets",
        "Kings and rulers",
      ],
      keywords: ["Ecology"],
    });
  });

  it("normalizes work details with an object-shaped description", () => {
    const item = normalizeOpenLibraryWork(loadFixture("openlibrary-work.json"), {
      authors: ["Frank Herbert"],
    });

    expect(item?.description).toContain("Arrakis");
    expect(item?.creators).toEqual(["Frank Herbert"]);
    expect(item?.coverUrl).toBe("https://covers.openlibrary.org/b/id/9255906-L.jpg");
    expect(item?.year).toBe(1965);
  });

  it("handles a book with no cover or description", () => {
    const item = normalizeOpenLibraryWork(loadFixture("openlibrary-work-sparse.json"));

    expect(item).toMatchObject({
      type: "book",
      source: "openlibrary",
      externalId: "OL1W",
      title: "Untitled Notebook",
      genres: [],
      keywords: [],
      creators: [],
    });
    expect(item?.description).toBeUndefined();
    expect(item?.coverUrl).toBeUndefined();
  });

  it("parses string and object descriptions and ignores missing ones", () => {
    expect(parseOpenLibraryDescription("A desert planet.")).toBe("A desert planet.");
    expect(parseOpenLibraryDescription({ value: "Paul Atreides." })).toBe("Paul Atreides.");
    expect(parseOpenLibraryDescription(undefined)).toBeUndefined();
    expect(parseOpenLibraryDescription(null)).toBeUndefined();
  });

  it("returns null instead of throwing when work metadata is incomplete", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(loadFixture("openlibrary-work-sparse.json")),
    );
    const provider = new OpenLibraryProvider({ fetch: fetchMock });
    const item = await provider.getById("/works/OL1W", "book");

    expect(item?.title).toBe("Untitled Notebook");
    expect(item?.description).toBeUndefined();
    expect(item?.coverUrl).toBeUndefined();
  });
});
