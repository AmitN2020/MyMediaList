# Rules for the AI Coding Agent

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
