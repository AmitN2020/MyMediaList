import { describe, it, expect } from "vitest";
import {
  items,
  userItems,
  users,
  accounts,
  sessions,
  verificationTokens,
  itemType,
  itemSource,
  itemStatus,
} from "@/db/schema";
import { getTableColumns } from "drizzle-orm";

describe("Database Schema", () => {
  it("defines item enums correctly", () => {
    expect(itemType.enumValues).toEqual(["movie", "tv", "book"]);
    expect(itemSource.enumValues).toEqual(["tmdb", "openlibrary"]);
    expect(itemStatus.enumValues).toEqual([
      "planned",
      "in_progress",
      "completed",
      "dropped",
    ]);
  });

  it("has all expected columns in items table including vector", () => {
    const columns = getTableColumns(items);
    expect(columns.id).toBeDefined();
    expect(columns.type).toBeDefined();
    expect(columns.source).toBeDefined();
    expect(columns.externalId).toBeDefined();
    expect(columns.title).toBeDefined();
    expect(columns.embedding).toBeDefined();
    expect(columns.genres).toBeDefined();
    expect(columns.keywords).toBeDefined();
    expect(columns.creators).toBeDefined();
  });

  it("has all expected columns in userItems table", () => {
    const columns = getTableColumns(userItems);
    expect(columns.id).toBeDefined();
    expect(columns.userId).toBeDefined();
    expect(columns.itemId).toBeDefined();
    expect(columns.status).toBeDefined();
    expect(columns.rating).toBeDefined();
    expect(columns.notes).toBeDefined();
  });

  it("has all expected columns in Auth.js tables", () => {
    const userColumns = getTableColumns(users);
    expect(userColumns.id).toBeDefined();
    expect(userColumns.email).toBeDefined();
    expect(userColumns.password).toBeDefined();

    const accountColumns = getTableColumns(accounts);
    expect(accountColumns.userId).toBeDefined();
    expect(accountColumns.provider).toBeDefined();
    expect(accountColumns.providerAccountId).toBeDefined();

    const sessionColumns = getTableColumns(sessions);
    expect(sessionColumns.sessionToken).toBeDefined();
    expect(sessionColumns.userId).toBeDefined();

    const tokenColumns = getTableColumns(verificationTokens);
    expect(tokenColumns.identifier).toBeDefined();
    expect(tokenColumns.token).toBeDefined();
  });
});
