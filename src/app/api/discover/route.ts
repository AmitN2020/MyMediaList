import { auth } from "@/auth";
import { jsonError } from "@/lib/api";
import { discoverQuerySchema } from "@/lib/discover-schemas";
import { searchCachedItemsText } from "@/server/recs/text-search";
import { groupHitsByType, searchCachedItemsSemantic } from "@/server/recs/search";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError(401, "UNAUTHORIZED", "Sign in required");
  }

  const { searchParams } = new URL(request.url);
  const parsed = discoverQuerySchema.safeParse({
    mode: searchParams.get("mode") ?? "text",
    q: searchParams.get("q"),
    type: searchParams.get("type") ?? "all",
    limit: searchParams.get("limit") ?? 20,
    page: searchParams.get("page") ?? 1,
    exclude_logged: searchParams.get("exclude_logged") ?? undefined,
  });

  if (!parsed.success) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid query parameters",
    );
  }

  const { mode } = parsed.data;

  if (mode === "text") {
    const { items, total } = await searchCachedItemsText(
      parsed.data,
      session.user.id,
    );
    return Response.json({ items, total, query: parsed.data });
  }

  try {
    const items = await searchCachedItemsSemantic(
      {
        q: parsed.data.q,
        type: parsed.data.type,
        limit: parsed.data.limit,
        excludeLogged: parsed.data.exclude_logged,
      },
      session.user.id,
    );
    return Response.json({
      items,
      groups: groupHitsByType(items),
      query: parsed.data,
    });
  } catch (error) {
    console.error("Semantic discovery failed:", error);
    return jsonError(502, "EMBEDDING_UNAVAILABLE", "Semantic search is temporarily unavailable");
  }
}
