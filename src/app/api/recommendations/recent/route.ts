import { auth } from "@/auth";
import { jsonError } from "@/lib/api";
import { recentRecommendationQuerySchema } from "@/lib/recommendation-schemas";
import { getRecentRecommendations } from "@/server/recs/recommendations";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return jsonError(401, "UNAUTHORIZED", "Sign in required");
  const parsed = recentRecommendationQuerySchema.safeParse({ limit: new URL(request.url).searchParams.get("limit") ?? 6 });
  if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid query parameters");
  return Response.json({ groups: await getRecentRecommendations(session.user.id, parsed.data.limit) });
}
