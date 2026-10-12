import type { ItemStatus } from "@/lib/library-schemas";
import type { ItemType } from "@/server/providers/types";

export type RecentActivityInput = {
  itemId: string;
  type: ItemType;
  title: string;
  status: ItemStatus;
  rating: number | null;
  completedAt: Date | null;
  updatedAt: Date;
  embedding: number[] | null;
};

export function isEligibleRecentActivity(entry: RecentActivityInput): boolean {
  return (entry.status === "completed" || entry.status === "in_progress")
    && (entry.rating === null || entry.rating >= 3)
    && entry.embedding !== null;
}

export function selectRecentActivities(entries: RecentActivityInput[], perType = 3): Record<ItemType, RecentActivityInput[]> {
  const types: ItemType[] = ["movie", "tv", "book"];
  return Object.fromEntries(types.map((type) => [type, entries
    .filter((entry) => entry.type === type && isEligibleRecentActivity(entry))
    .sort((a, b) => (b.completedAt ?? b.updatedAt).getTime() - (a.completedAt ?? a.updatedAt).getTime())
    .slice(0, perType),
  ])) as Record<ItemType, RecentActivityInput[]>;
}
