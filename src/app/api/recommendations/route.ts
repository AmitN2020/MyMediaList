import { auth } from "@/auth";
import { jsonError } from "@/lib/api";
import { recommendationQuerySchema } from "@/lib/recommendation-schemas";
import { getRecommendations } from "@/server/recs/recommendations";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return jsonError(401, "UNAUTHORIZED", "Sign in required");
  const params = new URL(request.url).searchParams;
  const parsed = recommendationQuerySchema.safeParse({ type: params.get("type") ?? "all", limit: params.get("limit") ?? 12 });
  if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid query parameters");
  const result = await getRecommendations(session.user.id, parsed.data.type, parsed.data.limit);
  return Response.json(result);
}
