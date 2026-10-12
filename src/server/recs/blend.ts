import { normalizeVector } from "./taste-vector";

export function blendVectors(
  queryVector: readonly number[],
  tasteVector: readonly number[] | null,
  tasteInfluence: number,
): number[] | null {
  if (queryVector.length === 0 || tasteInfluence < 0 || tasteInfluence > 1) return null;
  if (!tasteVector || tasteInfluence === 0) return normalizeVector(queryVector);
  if (queryVector.length !== tasteVector.length) return null;
  return normalizeVector(queryVector.map((value, index) =>
    (1 - tasteInfluence) * value + tasteInfluence * (tasteVector[index] ?? 0),
  ));
}
