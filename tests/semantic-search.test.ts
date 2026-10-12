import { describe, expect, it } from "vitest";
import { groupHitsByType, toVectorLiteral, type SemanticSearchHit } from "@/server/recs/search";

function hit(type: "movie" | "tv" | "book"): SemanticSearchHit {
  return { type } as SemanticSearchHit;
}

describe("semantic search helpers", () => {
  it("serializes finite vectors as pgvector literals", () => {
    expect(toVectorLiteral([0.25, -1, 0])).toBe("[0.25,-1,0]");
  });

  it("rejects unsafe vector values", () => {
    expect(() => toVectorLiteral([])).toThrow("finite");
    expect(() => toVectorLiteral([Number.NaN])).toThrow("finite");
  });

  it("groups mixed-media results by type", () => {
    const groups = groupHitsByType([hit("book"), hit("movie"), hit("book"), hit("tv")]);
    expect(groups.movie).toHaveLength(1);
    expect(groups.tv).toHaveLength(1);
    expect(groups.book).toHaveLength(2);
  });
});
