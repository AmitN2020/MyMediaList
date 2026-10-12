import { describe, expect, it } from "vitest";
import { blendVectors } from "@/server/recs/blend";

describe("query and taste blending", () => {
  it("uses the query vector unchanged when taste influence is zero", () => {
    expect(blendVectors([3, 4], [0, 1], 0)).toEqual([0.6, 0.8]);
  });

  it("blends query and taste at the requested influence", () => {
    const result = blendVectors([1, 0], [0, 1], 0.3);
    expect(result?.[0]).toBeCloseTo(0.9191, 3);
    expect(result?.[1]).toBeCloseTo(0.3939, 3);
  });

  it("uses the query when no taste vector exists", () => {
    expect(blendVectors([0, 2], null, 0.6)).toEqual([0, 1]);
  });
});
