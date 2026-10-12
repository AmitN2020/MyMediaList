import { z } from "zod";

const discoverItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["movie", "tv", "book"]),
  source: z.enum(["tmdb", "openlibrary"]),
  externalId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  year: z.number().int().nullable(),
  genres: z.array(z.string()),
  keywords: z.array(z.string()),
  creators: z.array(z.string()),
  coverUrl: z.string().nullable(),
  score: z.number(),
});

export const semanticDiscoverResponseSchema = z.object({
  items: z.array(discoverItemSchema),
  groups: z.object({
    movie: z.array(discoverItemSchema),
    tv: z.array(discoverItemSchema),
    book: z.array(discoverItemSchema),
  }),
});

export type SemanticDiscoverResponse = z.infer<typeof semanticDiscoverResponseSchema>;
