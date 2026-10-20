# MyMediaList
A modern, full-stack media tracking and recommendation platform for **movies**, **TV shows**, and **books**.

Log what you watch and read, track your progress, rate titles, and receive intelligent recommendations driven by your historical taste profile, and natural-language search.

---

## Features

### Universal Media Tracking
- Track **movies**, **TV series**, and **books** in a single unified catalog and library.
- Organize items by status: `Planned`, `In Progress`, `Completed`, or `Dropped`.
- Rate items on a 1–5 star scale with optional personal notes.
- Automatic lifecycle tracking (`startedAt`, `completedAt` timestamps) on status transitions.

### Multi-Provider Search & Automatic Caching
- **The Movie Database (TMDB)**: Live search for movies and TV shows with poster art, genres, release years, keywords, and creators.
- **Open Library**: Work-level search for books with cover imagery, author attribution, and publication details.
- **On-Demand Caching**: First-seen external items are normalized and cached into a single database table. All subsequent interactions, recommendations, and searches run entirely on local data without hitting external API rate limits.
- Built-in in-memory rate limiting to protect upstream provider quotas.

### Semantic Search & Recommendations
- **Google Gemini Embeddings**: Items and queries are converted into 768-dimensional dense vectors using Google Gemini Embeddings (`gemini-embedding-001`).
- **pgvector & HNSW Indexing**: High-performance nearest-neighbor cosine similarity queries directly inside PostgreSQL.
- **Natural-Language Discovery**: Search for titles using natural descriptive queries (e.g., *"atmospheric sci-fi thriller about artificial intelligence"* or *"cozy mystery in a quiet english village"*).
- **Personalized Taste Vector**: Builds an aggregated user taste vector from your library history, factoring in ratings, completion signals, drop signals, and exponential recency decay.
- **"Because You Watched / Read..." Feeds**: Generates tailored recommendations anchored to your recently engaged movies, shows, and books.
- **Blended Discovery**: Blend natural language query vectors with your personal taste vector using an adjustable slider (Query-only, 30% Taste, or 60% Taste) with genre-diversity caps.
- **Full-Text Search (FTS)**: Native PostgreSQL weighted `tsvector` and GIN index combining title (weight A), creators (weight B), and descriptions/genres/keywords (weight C).

### Authentication & Security
- Built with **Auth.js (NextAuth v5)** with Drizzle ORM adapter.
- Supports both **Email + Password** (securely salted with `bcryptjs`).
- JWT-based session strategy with edge-compatible middleware for instant route protection.
- Server-side validation on all route handlers and server actions using **Zod**.
- Third-party API keys remain strictly server-side.