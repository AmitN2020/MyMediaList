# MyMediaList: Build Plan

A website for tracking movies, TV shows, and books, with recommendations based on a user's overall history, their *recent* activity per media type, and free-text keyword search.

**How to use this file:** Put it in the repo root as `PLAN.md`. Copy Section 2 into `AGENTS.md` / `CLAUDE.md` / `.cursorrules` so your AI tool reads it every session. Then work through Section 6 one task at a time (see Section 12 for a prompt template). Don't ask the AI to "build the whole app" in one go.

---

## 1. Product Summary

**Core loop:** log what you've watched/read, rate it, and get a good recommendation.

**MVP features**
1. Sign up / log in.
2. Search for movies, TV shows, and books (via external APIs).
3. Add an item to your library with a status (planned / in progress / completed / dropped), rating (1-5), and optional notes.
4. View and filter your library.
5. Natural-language search ("cozy mystery with a clever detective") across all media types.
6. "Recommended for you" feed based on your overall ratings and history.
7. "Because you recently watched/read..." recommendations, generated separately per media type from your most recently logged movies, TV shows, and books.
8. Blended recommendations: a search query plus your taste.

**Out of scope for MVP:** social features, feeds, badges, comments, mobile app, collaborative filtering.

---

## 2. Rules for the AI Coding Agent

> Copy this section into your agent's rules file.

- **Stack:** Next.js (App Router) + TypeScript (strict), PostgreSQL + pgvector, Drizzle ORM, Auth.js v5, Tailwind CSS + shadcn/ui, Zod, Vitest, Playwright.
- Use **server components and route handlers** by default. Use client components only when interactivity requires it.
- Validate all external input (request bodies, query params, API responses) with **Zod**.
- All third-party API keys stay **server-side only**. Never import server modules into client components.
- Database access goes through `src/db/` and `src/server/` only. No SQL in components.
- One `items` table for all media types (`type` column). Do not create separate movie/tv/book tables.
- Items from external APIs are **cached in our database** the first time they're seen. Recommendations run on our data, never on live external calls.
- Embeddings are computed **once per item** and stored. Never recompute on a request path.
- Keep functions small and typed. No `any`. Prefer pure functions for scoring/ranking logic so they can be unit tested.
- Write tests for: provider normalizers, taste-vector math, ranking/blending, and API route validation.
- Make small commits. After each task: run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and fix failures before moving on.
- Do not add dependencies without saying why. Do not implement features outside the current task.
- When unsure about a decision, pick the simplest option and note it in `DECISIONS.md`.

---

## 3. Tech Stack and Rationale

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript | One codebase for UI and API; easy deploys |
| DB | PostgreSQL + pgvector (Neon or Supabase) | Relational data and vector search in one place |
| ORM | Drizzle | Good pgvector support, SQL-like, typed |
| Auth | Auth.js v5 (GitHub + Google + optional email) | Standard, free |
| UI | Tailwind + shadcn/ui | Fast, consistent, accessible |
| Validation | Zod | Shared schemas for API and forms |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dims) | Cheap and good. Swappable behind an interface |
| Movies/TV data | TMDB API | Large catalog, keywords, posters |
| Books data | Open Library API (fallback: Google Books) | Free, no key required |
| Testing | Vitest (unit), Playwright (e2e) | Standard |
| Hosting | Vercel (app) + Neon/Supabase (DB) | Simple, generous free tiers |
| Package manager | pnpm | Fast |

**Licensing note:** TMDB requires attribution (logo + notice in the footer/about page). Commercial use needs a separate agreement. Check their terms before monetizing.

---

## 4. Repository Structure

```
.
├── PLAN.md
├── AGENTS.md                 # rules from Section 2
├── DECISIONS.md              # running log of choices
├── drizzle/                  # generated migrations
├── scripts/
│   ├── seed.ts               # seed sample items + user data
│   ├── backfill-embeddings.ts
│   └── eval-recs.ts          # sanity-check recommendation quality
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx              # home: recs + recent activity
│   │   │   ├── search/page.tsx
│   │   │   ├── library/page.tsx
│   │   │   ├── items/[id]/page.tsx
│   │   │   └── discover/page.tsx     # semantic search + blended recs
│   │   └── api/
│   │       ├── search/route.ts           # external provider search
│   │       ├── items/route.ts            # cache item
│   │       ├── library/route.ts          # CRUD user_items
│   │       ├── discover/route.ts         # semantic search
│   │       └── recommendations/route.ts
│   ├── components/
│   │   ├── ui/                   # shadcn
│   │   ├── item-card.tsx
│   │   ├── status-select.tsx
│   │   ├── rating-input.tsx
│   │   └── library-filters.tsx
│   ├── db/
│   │   ├── schema.ts
│   │   └── client.ts
│   ├── server/
│   │   ├── providers/
│   │   │   ├── types.ts          # Provider interface + NormalizedItem
│   │   │   ├── tmdb.ts
│   │   │   └── openlibrary.ts
│   │   ├── items.ts              # upsert/cached item logic
│   │   ├── library.ts
│   │   ├── embeddings/
│   │   │   ├── client.ts         # EmbeddingProvider interface + OpenAI impl
│   │   │   └── build-text.ts     # item -> text blob
│   │   └── recs/
│   │       ├── taste-vector.ts
│   │       ├── recent-activity.ts # per-type "recently watched/read" recs
│   │       ├── search.ts
│   │       ├── blend.ts
│   │       └── explain.ts        # optional LLM rerank/explanations
│   ├── lib/                      # utils, constants, zod schemas
│   └── auth.ts
├── tests/                        # unit tests mirror src/
└── e2e/                          # Playwright
```

---

## 5. Data Model

### Environment variables (`.env.example`)

```
DATABASE_URL=
AUTH_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
TMDB_API_KEY=
OPENAI_API_KEY=
```

### Drizzle schema (starting point)

```ts
// src/db/schema.ts
import {
  pgTable, pgEnum, uuid, text, integer, timestamp, jsonb,
  smallint, uniqueIndex, index, vector,
} from "drizzle-orm/pg-core";

export const itemType = pgEnum("item_type", ["movie", "tv", "book"]);
export const itemSource = pgEnum("item_source", ["tmdb", "openlibrary"]);
export const itemStatus = pgEnum("item_status", [
  "planned", "in_progress", "completed", "dropped",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
// Add Auth.js adapter tables (accounts, sessions, verification_tokens) per Drizzle adapter docs.

export const items = pgTable("items", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: itemType("type").notNull(),
  source: itemSource("source").notNull(),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  year: integer("year"),
  genres: text("genres").array().notNull().default([]),
  keywords: text("keywords").array().notNull().default([]),
  creators: text("creators").array().notNull().default([]), // directors / authors
  coverUrl: text("cover_url"),
  metadata: jsonb("metadata"),               // runtime, seasons, page count, etc.
  embedding: vector("embedding", { dimensions: 1536 }),
  embeddingModel: text("embedding_model"),   // so we can re-embed on model change
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("items_source_external_idx").on(t.source, t.externalId),
  index("items_type_idx").on(t.type),
  index("items_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
]);

export const userItems = pgTable("user_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  itemId: uuid("item_id").references(() => items.id, { onDelete: "cascade" }).notNull(),
  status: itemStatus("status").notNull().default("planned"),
  rating: smallint("rating"),                // 1-5, null if unrated
  notes: text("notes"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("user_items_user_item_idx").on(t.userId, t.itemId),
  index("user_items_user_status_idx").on(t.userId, t.status),
]);
```

Add a CHECK constraint so `rating` is between 1 and 5.

### Normalized item shape (all providers return this)

```ts
type NormalizedItem = {
  type: "movie" | "tv" | "book";
  source: "tmdb" | "openlibrary";
  externalId: string;
  title: string;
  description?: string;
  year?: number;
  genres: string[];
  keywords: string[];
  creators: string[];
  coverUrl?: string;
  metadata?: Record<string, unknown>;
};
```

---

## 6. Build Phases and Tasks

Each task has **acceptance criteria**. Don't move on until they pass.

### Phase 0: Project setup

**Task 0.1: Scaffold**
- `pnpm create next-app` with TypeScript, Tailwind, ESLint, App Router, `src/` dir.
- Add shadcn/ui, Zod, Drizzle (`drizzle-orm`, `drizzle-kit`, `postgres` driver), Vitest.
- Add scripts: `lint`, `typecheck`, `test`, `db:generate`, `db:migrate`, `db:studio`.
- Add `.env.example`, `AGENTS.md`, `DECISIONS.md`.

*Accept:* `pnpm dev` runs, `pnpm lint && pnpm typecheck && pnpm test` pass (even with one trivial test).

**Task 0.2: Database**
- Create a Neon or Supabase project. Enable pgvector: `CREATE EXTENSION IF NOT EXISTS vector;`
- Wire `src/db/client.ts` using `DATABASE_URL`.

*Accept:* a script can connect and run `SELECT 1`.

### Phase 1: Schema and auth

**Task 1.1: Schema and migrations**
- Implement the schema from Section 5, including the Auth.js adapter tables.
- Generate and apply the migration. Make sure the `vector` extension is created in the first migration.

*Accept:* tables exist; `db:studio` shows them; HNSW index created.

**Task 1.2: Authentication**
- Auth.js v5 with Drizzle adapter, GitHub and Google providers.
- Middleware protecting `(app)` routes. Login page. Header with user menu and sign-out.

*Accept:* can sign in and out; unauthenticated visits to `/library` redirect to `/login`.

### Phase 2: External providers and item caching

**Task 2.1: Provider interface and TMDB**
- Define `Provider` interface in `providers/types.ts`:
  ```ts
  interface Provider {
    search(query: string, opts?: { type?: ItemType; page?: number }): Promise<NormalizedItem[]>;
    getById(externalId: string, type: ItemType): Promise<NormalizedItem | null>;
  }
  ```
- Implement `tmdb.ts`: search movies and TV (multi-search endpoint), details fetch including **genres, keywords, and credits** (director / creators). Build poster URLs from TMDB's image config.
- Parse responses with Zod.

*Accept:* unit tests with recorded fixture responses verify normalization for a movie and a TV show.

**Task 2.2: Open Library provider**
- Implement `openlibrary.ts`: search by title/author, fetch work details (description, subjects as genres/keywords), cover URL via the covers API.
- Handle missing descriptions and inconsistent description shapes (string or `{value}`).

*Accept:* fixture-based tests for normalization; a book with no cover or description doesn't crash.

**Task 2.3: Item caching**
- `server/items.ts`: `upsertItem(normalized)` using `ON CONFLICT (source, external_id) DO UPDATE`.
- `POST /api/items` takes `{source, externalId, type}`, fetches details if not cached, and returns the stored item.
- On cache, **do not** compute the embedding inline. Mark `embedding = null` (handled in Phase 5).

*Accept:* calling the endpoint twice for the same item creates one row.

### Phase 3: Search and library (this is a usable product)

**Task 3.1: Search page**
- `GET /api/search?q=&type=` fans out to TMDB and Open Library depending on `type` (all / movie / tv / book), merges results, returns normalized items.
- Search page with debounced input, type tabs, results grid of `ItemCard`s, loading and empty states.
- Rate-limit the endpoint per user (simple in-memory limiter is fine for MVP).

*Accept:* searching "dune" returns the movie(s) and book(s) with covers.

**Task 3.2: Add to library**
- `ItemCard` has an "Add" control with status dropdown. Adding calls cache + creates `user_items` row (idempotent).
- `PATCH /api/library/:itemId` updates status / rating / notes. `DELETE` removes.
- Rating input (1-5 stars). Setting status to `completed` sets `completedAt`; `in_progress` sets `startedAt` if empty.

*Accept:* e2e test: search, add, change status, rate, and see it reflected after reload.

**Task 3.3: Library page**
- List the user's items with filters (type, status, rating, genre) and sort (recently updated, rating, title, year).
- Pagination or infinite scroll.
- Item detail page `/items/[id]` with metadata, your status/rating/notes, and (later) "Similar items".

*Accept:* filters combine correctly; counts shown per status.

### Phase 4: Own-database search (no AI yet)

**Task 4.1: Full-text search over cached items**
- Add a generated `tsvector` column (title weighted A, creators B, description/genres/keywords C) with a GIN index.
- `GET /api/discover?mode=text&q=` returns matching cached items.

*Accept:* query for a creator name returns their works; title matches rank above description matches.

### Phase 5: Embeddings pipeline

**Task 5.1: Embedding client and text builder**
- `embeddings/client.ts`: `interface EmbeddingProvider { embed(texts: string[]): Promise<number[][]>; model: string; dimensions: number }` with an OpenAI implementation. Batch requests, retry with backoff.
- `embeddings/build-text.ts`: deterministic text blob:
  ```
  {Type}: {title} ({year})
  By: {creators}
  Genres: {genres}
  Themes: {keywords}
  {description}
  ```
  Truncate description to a sane length (about 1,500 characters).

*Accept:* unit test: same item always yields the same text; missing fields are omitted cleanly.

**Task 5.2: Backfill and on-demand embedding**
- `scripts/backfill-embeddings.ts`: embeds all items where `embedding IS NULL` in batches of 50-100; stores `embeddingModel`.
- After an item is cached (Task 2.3), enqueue embedding. For the MVP, simply call a background function after the response, or use a cron/route that processes pending items.
- Make it idempotent and resumable.

*Accept:* running the script twice does no duplicate work; all seeded items have embeddings.

**Task 5.3: Seed data**
- `scripts/seed.ts`: pull ~300-500 popular items (TMDB popular/top-rated movies and TV, a list of well-known books via Open Library search on several subjects), cache them, embed them.
- Also create a demo user with ~30 rated items across all three types so recommendations can be tested.

*Accept:* the items table has 300+ rows across all three types with embeddings.

### Phase 6: Semantic search

**Task 6.1: Vector search**
- `recs/search.ts`: embed the query (cache query embeddings briefly in memory), then:
  ```sql
  SELECT id, title, type, 1 - (embedding <=> $1) AS score
  FROM items
  WHERE embedding IS NOT NULL
    AND ($2::item_type IS NULL OR type = $2)
    AND ($3::int IS NULL OR year >= $3)
    AND id NOT IN (SELECT item_id FROM user_items WHERE user_id = $4)  -- optional toggle
  ORDER BY embedding <=> $1
  LIMIT $5;
  ```
- `GET /api/discover?mode=semantic&q=&type=&exclude_logged=true`.
- Offer a **mixed-media mode**: return the top K per type (e.g., 5 movies, 5 shows, 5 books) so results aren't dominated by one medium.

*Accept:* "cozy mystery with a clever detective" returns plausible results across types. Record 10 test queries and their expected-ish results in `scripts/eval-recs.ts`.

**Task 6.2: Discover page UI**
- Search box with example prompts, type filter chips, grouped results (Movies / Shows / Books), quick "Add" actions.

*Accept:* works on mobile width; loading and error states present.

### Phase 7: Recommendations from history

**Task 7.1: Taste vector**
- `recs/taste-vector.ts` (pure function plus a DB loader).
- Weights per logged item:
  - `rating` 1-5 → `w = (rating - 3) / 2` (range -1 to +1)
  - `completed` with no rating → `+0.3`
  - `dropped` with no rating → `-0.3`
  - `planned` / `in_progress` with no rating → ignored
- Optional recency boost: multiply by `1 + 0.5 * exp(-ageDays / 365)`.
- `taste = normalize(Σ w_i * embedding_i)`. If the total positive weight is zero (nothing liked yet), return `null` and fall back to popular items.

*Accept:* unit tests: all-positive ratings produce a vector close to the mean; dislikes push the vector away; empty history returns `null`.

**Task 7.2: History-based recommendations**
- `GET /api/recommendations?type=&limit=` runs nearest-neighbor search with the taste vector, excluding anything in the user's library.
- Diversity: apply **MMR (maximal marginal relevance)** or simply cap results per genre so the feed isn't ten near-duplicates.
- Cold start: with fewer than 3 rated items, show popular items plus a prompt to rate more.

*Accept:* the demo user gets sensible recs; none are already in their library; results differ per user.

**Task 7.3: "Similar items" on the detail page**
- Nearest neighbors of the item's own embedding, excluding itself.

*Accept:* similar items to a known sci-fi film are mostly sci-fi.

**Task 7.4: Recency-based recommendations ("Because you recently watched/read...")**
- `recs/recent-activity.ts`: for each type (`movie`, `tv`, `book`) independently, take the user's N most recently logged items of that type (by `completedAt`, falling back to `updatedAt`), filtered to `status IN (completed, in_progress)` and, if rated, `rating >= 3` (don't anchor recommendations on something they disliked).
- For each recent item, either:
  - run a per-item nearest-neighbor query and keep the top few, **or**
  - average the embeddings of the last N items of that type (recency-weighted, most recent weighted highest) into a short-term "recent taste" vector per type, then run one nearest-neighbor query.
  
  Default to the **per-item** approach for Task 7.4, since it supports the "Because you watched X" label directly; the averaged variant is a fast follow if per-item calls get slow.
- Exclude items already in the user's library. Cap results per type (e.g., top 6 movies, 6 shows, 6 books).
- Each result carries a `becauseOf: { itemId, title }` reference back to the source item, so the UI can render "Because you watched *Arrival*".
- Cold start per type: if the user has fewer than 1 completed/in-progress item of that type, omit that type's row instead of showing an empty or generic section.
- Home page shows up to three horizontal rows, one per type, above or alongside the general "Recommended for you" feed from Task 7.2.

*Accept:* unit test for the selection and weighting logic (recent items only, status/rating filters applied, correct `becauseOf` mapping); for the demo user, each type's row reflects their actual last few logged items in that type and excludes already-logged items.

### Phase 8: Blended recommendations

**Task 8.1: Query plus taste**
- `recs/blend.ts`: `q = normalize(α * queryVec + (1 - α) * tasteVec)`, default `α = 0.7`. Expose an "influence of my taste" slider (0 / 30 / 60%).
- Support hard filters (type, year range, exclude logged) alongside the blend.
- If no taste vector exists, use the query vector only.

*Accept:* the same query returns visibly different top results for two users with different histories; with the slider at 0 results match plain semantic search.

### Phase 9: Explanations (optional, high value)

**Task 9.1: LLM re-rank and "why"**
- Take the top 20 candidates plus the user's top 5-10 liked items. Ask an LLM to pick the best 10 and write a one-sentence reason each. Require structured JSON output validated with Zod.
- Cache explanations per (user, item) for a few days. Fall back to unranked results on failure or timeout.
- Hard rule: the LLM may only choose from the candidate list, never invent titles.

*Accept:* every returned id exists in the candidate set; reasons reference items from the user's actual history.

### Phase 10: Polish and extras

- **Task 10.1:** Import from CSV (Goodreads, Letterboxd). Match by title and year/ISBN against providers; show a review screen for ambiguous matches.
- **Task 10.2:** Stats page (items per month, average rating, top genres, pages read, hours watched).
- **Task 10.3:** Settings: export data (JSON/CSV), delete account.
- **Task 10.4:** Accessibility pass (keyboard navigation, alt text, contrast), SEO basics, empty states, error boundaries, skeleton loaders.
- **Task 10.5:** TMDB attribution in the footer.

### Phase 11: Deployment

- Deploy to Vercel; set env vars; run migrations in CI or as a release step.
- Seed script run against production for the base catalog.
- Add Sentry (or similar) for error tracking and basic analytics.
- Add a daily cron route to embed any pending items and refresh stale metadata.

*Accept:* production works end to end with a fresh account.

---

## 7. Recommendation Algorithm Summary

```
Item embedding  = embed(type, title, year, creators, genres, keywords, description)

Query search    = nearest neighbors to embed(query)

Taste vector    = normalize( Σ weight(rating/status) * item_embedding )

History recs    = nearest neighbors to taste vector, minus items in library, diversified (MMR)

Recent-activity recs (per type) =
                  for each of the last N logged movies / tv shows / books (status
                  completed or in_progress, rating >= 3 if rated):
                    nearest neighbors to that item's embedding, minus items in library
                  shown as "Because you watched/read {title}", grouped by type

Blended recs    = nearest neighbors to normalize(α·query + (1-α)·taste), with filters

Optional        = LLM re-rank of top 20 with explanations (choose-from-list only)

Later           = collaborative filtering once there are enough real users
```

Quality levers, in order of impact: richer item text (keywords and creators), enough catalog coverage, good rating weights, diversity, and the optional LLM re-rank. Evaluate changes with `scripts/eval-recs.ts` instead of by feel.

---

## 8. API Reference (planned)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/search?q=&type=` | Search external providers |
| POST | `/api/items` | Cache an item by source and externalId |
| GET | `/api/library?type=&status=&sort=` | List user's items |
| POST | `/api/library` | Add item to library |
| PATCH | `/api/library/:itemId` | Update status, rating, notes |
| DELETE | `/api/library/:itemId` | Remove from library |
| GET | `/api/discover?mode=text\|semantic&q=&type=` | Search cached items |
| GET | `/api/recommendations?type=&limit=&q=&taste=` | History-based and blended recs |
| GET | `/api/recommendations/recent?type=&limit=` | "Because you recently watched/read..." recs, grouped by type |
| GET | `/api/items/:id/similar` | Similar items |

All routes: authenticate, validate with Zod, return typed JSON, and return consistent error shapes `{ error: { code, message } }`.

---

## 9. Testing Strategy

- **Unit (Vitest):** provider normalizers (with fixtures), `build-text`, taste-vector math, blend math, MMR, status/rating transition logic.
- **Integration:** API routes against a test database (a separate Neon branch or local Postgres with pgvector in Docker).
- **E2E (Playwright):** sign in, search, add, rate, view library, run a semantic search, see recs. Mock external APIs in e2e.
- **Recommendation evals:** a script with fixed queries and a demo user, printing top results for eyeballing and basic assertions (e.g., "no logged items returned", "all three types appear in mixed mode").

---

## 10. Risks and Gotchas

- **Cold start:** a new user has no taste vector. Provide popular items and an onboarding "rate 5 things you love" step.
- **Provider data quality:** missing descriptions, covers, and years are common, especially for books. Normalizers must be defensive. Weak items produce weak embeddings, so consider skipping items with almost no text.
- **Duplicates:** the same work may appear under multiple editions (books) or as a movie and a remake. Dedupe books at the *work* level, not the edition level.
- **Cross-media similarity:** embeddings compare themes and tone well, but a movie and a book with the same text description aren't necessarily the same "vibe". Mixed mode with per-type quotas helps.
- **Embedding model changes:** store `embeddingModel`. Changing models requires re-embedding everything, so keep the provider abstract.
- **Cost:** embeddings are cheap, but LLM re-ranking per request isn't. Cache it and make it opt-in at first.
- **Rate limits and ToS:** cache aggressively, respect each API's limits and attribution rules.
- **Security:** authorization checks on every `user_items` query (scope by `userId`); never trust client-sent user IDs.

---

## 11. Milestones

| Milestone | Contents | Outcome |
|---|---|---|
| M1 | Phases 0-1 | Running app with auth and DB |
| M2 | Phases 2-3 | Usable tracker (search, add, rate, library) |
| M3 | Phases 4-6 | Text and semantic search over a seeded catalog |
| M4 | Phases 7-8 | Personalized, recency-based, and blended recommendations |
| M5 | Phases 9-11 | Explanations, imports, stats, production deploy |

---

## 12. Prompt Templates for Your AI Coding Tool

**Starting a task**
```
Read PLAN.md and AGENTS.md. We are working on Task <X.Y>: <name>.
Implement only this task. Follow the acceptance criteria exactly.
Before writing code, list the files you'll create or change and any new
dependencies (with reasons). Then implement, add tests, and run lint,
typecheck, and tests. Summarize what changed and anything left undone.
```

**Fixing a failure**
```
<paste error>
Explain the root cause first, then propose the smallest fix. Don't refactor
unrelated code. Re-run the checks after fixing.
```

**Reviewing before moving on**
```
Review the changes for Task <X.Y> against its acceptance criteria and the
rules in AGENTS.md. List any gaps, security issues (especially user-scoping
on queries and server-only keys), and missing tests. Don't change code yet.
```

**Tuning recommendations**
```
Here are the outputs of scripts/eval-recs.ts: <paste>.
Suggest 3 concrete changes to build-text, weighting, or diversity that would
improve these results, with the tradeoffs. Implement the one I choose.
```

---

## 13. Backlog (after MVP)

- Collaborative filtering ("people with similar taste also liked") once there are 500+ active users
- Social: follow users, share lists, activity feed
- Custom lists and collections
- Reviews and public profiles
- Watch-provider availability ("where to stream") via TMDB
- Episode-level TV tracking
- Reading progress by page
- Notifications for new seasons and releases
- Mobile app (React Native / Expo) sharing the same API
- Admin dashboard for catalog and embedding health