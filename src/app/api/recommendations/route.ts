import { auth } from "@/auth";
import { jsonError } from "@/lib/api";
import { recommendationQuerySchema } from "@/lib/recommendation-schemas";
import { getRecommendations } from "@/server/recs/recommendations";
import { getBlendedRecommendations } from "@/server/recs/recommendations";
import { groupHitsByType } from "@/server/recs/search";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return jsonError(401, "UNAUTHORIZED", "Sign in required");
  const params = new URL(request.url).searchParams;
  const parsed = recommendationQuerySchema.safeParse({ type: params.get("type") ?? "all", limit: params.get("limit") ?? 12, q: params.get("q") ?? undefined, taste: params.get("taste") ?? 0.3, exclude_logged: params.get("exclude_logged") ?? undefined, year_from: params.get("year_from") ?? undefined, year_to: params.get("year_to") ?? undefined });
  if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid query parameters");
  if (parsed.data.q) {
    const result = await getBlendedRecommendations(session.user.id, { q: parsed.data.q, type: parsed.data.type, limit: parsed.data.limit, tasteInfluence: parsed.data.taste, excludeLogged: parsed.data.exclude_logged, yearFrom: parsed.data.year_from, yearTo: parsed.data.year_to });
    return Response.json({ ...result, groups: groupHitsByType(result.items), query: parsed.data });
  }
  const result = await getRecommendations(session.user.id, parsed.data.type, parsed.data.limit);
  return Response.json(result);
}
