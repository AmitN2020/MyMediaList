import { auth } from "@/auth";
import { jsonError } from "@/lib/api";
import { addToLibrarySchema, libraryQuerySchema } from "@/lib/library-schemas";
import { addToLibrary, listLibraryItems } from "@/server/library";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError(401, "UNAUTHORIZED", "Sign in required");
  }

  const { searchParams } = new URL(request.url);
  const parsed = libraryQuerySchema.safeParse({
    type: searchParams.get("type") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    sort: searchParams.get("sort") ?? "updated_at",
    order: searchParams.get("order") ?? "desc",
    page: searchParams.get("page") ?? 1,
    limit: searchParams.get("limit") ?? 20,
  });

  if (!parsed.success) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid query parameters",
    );
  }

  const { rows, total } = await listLibraryItems(session.user.id, parsed.data);
  return Response.json({ items: rows, total, query: parsed.data });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError(401, "UNAUTHORIZED", "Sign in required");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be JSON");
  }

  const parsed = addToLibrarySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid request",
    );
  }

  const row = await addToLibrary(session.user.id, parsed.data);
  return Response.json(row, { status: 201 });
}
