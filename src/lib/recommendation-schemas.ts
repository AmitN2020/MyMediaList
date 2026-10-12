import { z } from "zod";

export const recommendationQuerySchema = z.object({
  type: z.enum(["all", "movie", "tv", "book"]).default("all"),
  limit: z.coerce.number().int().min(1).max(20).default(12),
});

export const recentRecommendationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(12).default(6),
});

export const itemIdParamSchema = z.object({ id: z.string().uuid("Item id must be a UUID") });
