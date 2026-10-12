import { auth } from "@/auth";
import { jsonError } from "@/lib/api";
import { itemIdParamSchema, recommendationQuerySchema } from "@/lib/recommendation-schemas";
import { getSimilarItems } from "@/server/recs/recommendations";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return jsonError(401, "UNAUTHORIZED", "Sign in required");
  const id = itemIdParamSchema.safeParse(await context.params);
  const limit = recommendationQuerySchema.pick({ limit: true }).safeParse({ limit: new URL(request.url).searchParams.get("limit") ?? 6 });
  if (!id.success || !limit.success) return jsonError(400, "VALIDATION_ERROR", id.error?.issues[0]?.message ?? limit.error?.issues[0]?.message ?? "Invalid request");
  const items = await getSimilarItems(id.data.id, session.user.id, limit.data.limit);
  if (items === null) return jsonError(404, "NOT_FOUND", "Item not found");
  return Response.json({ items });
}
