# Decisions Log

This document records architectural, design, and dependency choices made during the development of MyMediaList.

## Decisions

### 2026-10-11: Project Initialization & Setup (Task 0.1)
- **App Directory Structure:** Initialized Next.js 15+ App Router in `mymedialist` moving to workspace root, using TypeScript, Tailwind CSS, ESLint, and `src/` directory.
- **ORM & Database:** Drizzle ORM selected with `postgres` driver for pgvector compatibility on Neon / Supabase.
- **Rules Documentation:** Populated `AGENTS.md` directly from Section 2 of `PLAN.md`.
