import { cacheItemRequestSchema } from "@/lib/item-schemas";
import { jsonError } from "@/lib/api";
import { auth } from "@/auth";
import { getOrCreateCachedItem, ItemNotFoundError } from "@/server/items";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return jsonError(401, "UNAUTHORIZED", "Sign in required");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be JSON");
  }

  const parsed = cacheItemRequestSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid request");
  }

  try {
    const item = await getOrCreateCachedItem(parsed.data);
    return Response.json(item);
  } catch (error) {
    if (error instanceof ItemNotFoundError) {
      return jsonError(404, "NOT_FOUND", error.message);
    }
    throw error;
  }
}
