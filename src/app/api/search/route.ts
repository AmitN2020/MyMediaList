import { auth } from "@/auth";
import { jsonError } from "@/lib/api";
import { searchQuerySchema } from "@/lib/library-schemas";
import { fanOutSearch, checkRateLimit } from "@/server/search";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError(401, "UNAUTHORIZED", "Sign in required");
  }

  if (!checkRateLimit(session.user.id)) {
    return jsonError(429, "RATE_LIMITED", "Too many requests. Please wait a moment.");
  }

  const { searchParams } = new URL(request.url);
  const parsed = searchQuerySchema.safeParse({
    q: searchParams.get("q"),
    type: searchParams.get("type") ?? "all",
    page: searchParams.get("page") ?? 1,
  });

  if (!parsed.success) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid query parameters",
    );
  }

  const items = await fanOutSearch(parsed.data);
  return Response.json({ items, query: parsed.data });
}
