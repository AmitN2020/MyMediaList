import type { ItemStatus } from "@/lib/library-schemas";

export type TasteVectorInput = {
  embedding: number[];
  rating: number | null;
  status: ItemStatus;
  completedAt: Date | null;
  updatedAt: Date;
};

export function normalizeVector(vector: readonly number[]): number[] | null {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude === 0 ? null : vector.map((value) => value / magnitude);
}

export function tasteWeight(entry: Omit<TasteVectorInput, "embedding">, now = new Date()): number {
  const base = entry.rating !== null
    ? (entry.rating - 3) / 2
    : entry.status === "completed"
      ? 0.3
      : entry.status === "dropped"
        ? -0.3
        : 0;
  if (base === 0) return 0;
  const date = entry.completedAt ?? entry.updatedAt;
  const ageDays = Math.max(0, (now.getTime() - date.getTime()) / 86_400_000);
  return base * (1 + 0.5 * Math.exp(-ageDays / 365));
}

export function buildTasteVector(entries: TasteVectorInput[], now = new Date()): number[] | null {
  const eligible = entries.filter((entry) => entry.embedding.length > 0 && tasteWeight(entry, now) !== 0);
  if (eligible.length === 0) return null;
  const dimension = eligible[0]?.embedding.length;
  if (!dimension || eligible.some((entry) => entry.embedding.length !== dimension)) return null;

  const positiveWeight = eligible.reduce((sum, entry) => Math.max(0, tasteWeight(entry, now)) + sum, 0);
  if (positiveWeight === 0) return null;

  const combined = new Array<number>(dimension).fill(0);
  for (const entry of eligible) {
    const weight = tasteWeight(entry, now);
    entry.embedding.forEach((value, index) => { combined[index] += weight * value; });
  }
  return normalizeVector(combined);
}
