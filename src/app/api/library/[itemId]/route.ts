import { auth } from "@/auth";
import { jsonError } from "@/lib/api";
import { updateLibrarySchema } from "@/lib/library-schemas";
import { removeFromLibrary, updateLibraryItem } from "@/server/library";

interface RouteParams {
  params: Promise<{ itemId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError(401, "UNAUTHORIZED", "Sign in required");
  }

  const { itemId } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be JSON");
  }

  const parsed = updateLibrarySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid request",
    );
  }

  const row = await updateLibraryItem(session.user.id, itemId, parsed.data);
  if (!row) {
    return jsonError(404, "NOT_FOUND", "Item not in your library");
  }

  return Response.json(row);
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError(401, "UNAUTHORIZED", "Sign in required");
  }

  const { itemId } = await params;
  const deleted = await removeFromLibrary(session.user.id, itemId);

  if (!deleted) {
    return jsonError(404, "NOT_FOUND", "Item not in your library");
  }

  return new Response(null, { status: 204 });
}
