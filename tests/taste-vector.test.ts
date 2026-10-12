import { describe, expect, it } from "vitest";
import { buildTasteVector, tasteWeight } from "@/server/recs/taste-vector";

const now = new Date("2026-10-13T00:00:00Z");
const updatedAt = new Date("2026-10-12T00:00:00Z");

describe("taste vector", () => {
  it("averages positive ratings into a normalized taste", () => {
    const taste = buildTasteVector([
      { embedding: [1, 0], rating: 5, status: "completed", completedAt: updatedAt, updatedAt },
      { embedding: [0, 1], rating: 5, status: "completed", completedAt: updatedAt, updatedAt },
    ], now);
    expect(taste?.[0]).toBeCloseTo(Math.SQRT1_2);
    expect(taste?.[1]).toBeCloseTo(Math.SQRT1_2);
  });

  it("uses dislikes to push the taste away", () => {
    const taste = buildTasteVector([
      { embedding: [1, 0], rating: 5, status: "completed", completedAt: updatedAt, updatedAt },
      { embedding: [0, 1], rating: 1, status: "completed", completedAt: updatedAt, updatedAt },
    ], now);
    expect(taste?.[0]).toBeGreaterThan(0);
    expect(taste?.[1]).toBeLessThan(0);
  });

  it("returns null without a positive preference", () => {
    expect(buildTasteVector([{ embedding: [1, 0], rating: 1, status: "completed", completedAt: updatedAt, updatedAt }], now)).toBeNull();
  });

  it("ignores planned and in-progress rows without ratings", () => {
    expect(tasteWeight({ rating: null, status: "planned", completedAt: null, updatedAt }, now)).toBe(0);
    expect(tasteWeight({ rating: null, status: "in_progress", completedAt: null, updatedAt }, now)).toBe(0);
  });
});
