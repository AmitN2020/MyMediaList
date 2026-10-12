import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  smallint,
  uniqueIndex,
  index,
  vector,
  primaryKey,
  check,
  customType,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

export const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// Enums
export const itemType = pgEnum("item_type", ["movie", "tv", "book"]);
export const itemSource = pgEnum("item_source", ["tmdb", "openlibrary"]);
export const itemStatus = pgEnum("item_status", [
  "planned",
  "in_progress",
  "completed",
  "dropped",
]);

// Auth.js & User tables
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ]
);

// Core media catalog items table
export const items = pgTable(
  "items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: itemType("type").notNull(),
    source: itemSource("source").notNull(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    year: integer("year"),
    genres: text("genres")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    keywords: text("keywords")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    creators: text("creators")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`), // directors / authors
    coverUrl: text("cover_url"),
    metadata: jsonb("metadata"), // runtime, seasons, page count, etc.
    embedding: vector("embedding", { dimensions: 1536 }),
    embeddingModel: text("embedding_model"), // so we can re-embed on model change
    searchTsv: tsvector("search_tsv").generatedAlwaysAs(
      (): ReturnType<typeof sql> =>
        sql`setweight(to_tsvector('english'::regconfig, coalesce("title", '')), 'A') || setweight(to_tsvector('english'::regconfig, coalesce(immutable_array_to_string("creators", ' '), '')), 'B') || setweight(to_tsvector('english'::regconfig, coalesce("description", '') || ' ' || coalesce(immutable_array_to_string("genres", ' '), '') || ' ' || coalesce(immutable_array_to_string("keywords", ' '), '')), 'C')`
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("items_source_external_idx").on(t.source, t.externalId),
    index("items_type_idx").on(t.type),
    index("items_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("items_search_tsv_idx").using("gin", t.searchTsv),
  ]
);

// User library items
export const userItems = pgTable(
  "user_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    status: itemStatus("status").notNull().default("planned"),
    rating: smallint("rating"), // 1-5, null if unrated
    notes: text("notes"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("user_items_user_item_idx").on(t.userId, t.itemId),
    index("user_items_user_status_idx").on(t.userId, t.status),
    check(
      "user_items_rating_check",
      sql`${t.rating} IS NULL OR (${t.rating} >= 1 AND ${t.rating} <= 5)`
    ),
  ]
);

// Drizzle Relations
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  userItems: many(userItems),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const itemsRelations = relations(items, ({ many }) => ({
  userItems: many(userItems),
}));

export const userItemsRelations = relations(userItems, ({ one }) => ({
  user: one(users, {
    fields: [userItems.userId],
    references: [users.id],
  }),
  item: one(items, {
    fields: [userItems.itemId],
    references: [items.id],
  }),
}));
