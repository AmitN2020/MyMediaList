import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { items, userItems } from "@/db/schema";
import type {
  AddToLibraryRequest,
  LibraryQuery,
  UpdateLibraryRequest,
} from "@/lib/library-schemas";

export type UserItemWithItem = typeof userItems.$inferSelect & {
  item: typeof items.$inferSelect;
};

export type UserItemRow = typeof userItems.$inferSelect;

/**
 * Add an item to a user's library. If the row already exists (idempotent), return
 * the existing row unchanged.
 */
export async function addToLibrary(
  userId: string,
  request: AddToLibraryRequest,
): Promise<UserItemRow> {
  const now = new Date();
  const startedAt =
    request.status === "in_progress" || request.status === "completed"
      ? now
      : null;
  const completedAt = request.status === "completed" ? now : null;

  const [row] = await db
    .insert(userItems)
    .values({
      userId,
      itemId: request.itemId,
      status: request.status,
      rating: request.rating ?? null,
      notes: request.notes ?? null,
      startedAt,
      completedAt,
    })
    .onConflictDoNothing()
    .returning();

  if (row) return row;

  // Already exists — return the existing row
  const existing = await db.query.userItems.findFirst({
    where: and(
      eq(userItems.userId, userId),
      eq(userItems.itemId, request.itemId),
    ),
  });
  if (!existing) throw new Error("userItems row disappeared unexpectedly");
  return existing;
}

/**
 * Update an existing user_items row. Automatically sets startedAt / completedAt
 * based on status transitions.
 */
export async function updateLibraryItem(
  userId: string,
  itemId: string,
  patch: UpdateLibraryRequest,
): Promise<UserItemRow | null> {
  // Fetch the current row to compute timestamp transitions
  const current = await db.query.userItems.findFirst({
    where: and(eq(userItems.userId, userId), eq(userItems.itemId, itemId)),
  });
  if (!current) return null;

  const now = new Date();
  const newStatus = patch.status ?? current.status;

  const startedAt =
    patch.status === "in_progress" && !current.startedAt ? now : current.startedAt;
  const completedAt =
    patch.status === "completed" && !current.completedAt
      ? now
      : patch.status !== "completed"
        ? current.completedAt
        : current.completedAt;

  const [row] = await db
    .update(userItems)
    .set({
      ...(patch.status !== undefined && { status: newStatus }),
      ...(patch.rating !== undefined && { rating: patch.rating }),
      ...(patch.notes !== undefined && { notes: patch.notes }),
      startedAt,
      completedAt,
      updatedAt: now,
    })
    .where(and(eq(userItems.userId, userId), eq(userItems.itemId, itemId)))
    .returning();

  return row ?? null;
}

/**
 * Remove an item from a user's library.
 * Returns true if a row was deleted, false if not found.
 */
export async function removeFromLibrary(
  userId: string,
  itemId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(userItems)
    .where(and(eq(userItems.userId, userId), eq(userItems.itemId, itemId)))
    .returning({ id: userItems.id });
  return deleted.length > 0;
}

/**
 * List a user's library items with optional filters and sorting.
 */
export async function listLibraryItems(
  userId: string,
  query: LibraryQuery,
): Promise<{ rows: UserItemWithItem[]; total: number }> {
  const conditions = [eq(userItems.userId, userId)];
  if (query.status) conditions.push(eq(userItems.status, query.status));

  const sortColumn = (() => {
    switch (query.sort) {
      case "rating":
        return userItems.rating;
      case "title":
        return items.title;
      case "year":
        return items.year;
      default:
        return userItems.updatedAt;
    }
  })();

  const direction = query.order === "asc" ? asc : desc;
  const offset = (query.page - 1) * query.limit;

  const rows = await db.query.userItems.findMany({
    where: and(...conditions),
    with: { item: true },
    orderBy: direction(sortColumn),
    limit: query.limit,
    offset,
  });

  // Filter by type after join (Drizzle relational doesn't support join-level WHERE easily)
  const filtered = query.type
    ? (rows.filter((r) => r.item.type === query.type) as UserItemWithItem[])
    : (rows as UserItemWithItem[]);

  // Total count for pagination — a second lightweight query
  const totalRows = await db.query.userItems.findMany({
    where: and(...conditions),
    with: { item: true },
    columns: { id: true },
  });
  const total = query.type
    ? totalRows.filter((r) => r.item.type === query.type).length
    : totalRows.length;

  return { rows: filtered, total };
}

/**
 * Get a single user_items row (with joined item) for a given user+item.
 */
export async function getUserItem(
  userId: string,
  itemId: string,
): Promise<UserItemWithItem | null> {
  const row = await db.query.userItems.findFirst({
    where: and(eq(userItems.userId, userId), eq(userItems.itemId, itemId)),
    with: { item: true },
  });
  return (row as UserItemWithItem | undefined) ?? null;
}

/**
 * Get all user_items (just the itemId set) for checking library membership.
 */
export async function getUserLibraryItemIds(
  userId: string,
): Promise<Set<string>> {
  const rows = await db.query.userItems.findMany({
    where: eq(userItems.userId, userId),
    columns: { itemId: true },
  });
  return new Set(rows.map((r) => r.itemId));
}
