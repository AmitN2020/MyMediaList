import { describe, expect, it } from "vitest";
import { selectRecentActivities } from "@/server/recs/recent-activity";

const date = (day: number) => new Date(`2026-10-${String(day).padStart(2, "0")}T00:00:00Z`);

describe("recent activity selection", () => {
  it("keeps recent eligible items separately by media type", () => {
    const groups = selectRecentActivities([
      { itemId: "movie-new", type: "movie", title: "New", status: "completed", rating: 4, completedAt: date(12), updatedAt: date(12), embedding: [1] },
      { itemId: "movie-old", type: "movie", title: "Old", status: "in_progress", rating: null, completedAt: null, updatedAt: date(10), embedding: [1] },
      { itemId: "dropped", type: "movie", title: "Dropped", status: "dropped", rating: 5, completedAt: date(13), updatedAt: date(13), embedding: [1] },
      { itemId: "disliked", type: "book", title: "Disliked", status: "completed", rating: 2, completedAt: date(13), updatedAt: date(13), embedding: [1] },
      { itemId: "show", type: "tv", title: "Show", status: "completed", rating: null, completedAt: date(11), updatedAt: date(11), embedding: [1] },
    ]);
    expect(groups.movie.map((item) => item.itemId)).toEqual(["movie-new", "movie-old"]);
    expect(groups.tv.map((item) => item.itemId)).toEqual(["show"]);
    expect(groups.book).toEqual([]);
  });
});
