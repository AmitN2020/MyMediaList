import { z } from "zod";

export const recommendationQuerySchema = z.object({
  type: z.enum(["all", "movie", "tv", "book"]).default("all"),
  limit: z.coerce.number().int().min(1).max(20).default(12),
  q: z.string().min(1).max(300).optional(),
  taste: z.coerce.number().refine((value) => [0, 0.3, 0.6].includes(value), "Taste influence must be 0, 0.3, or 0.6").default(0.3),
  exclude_logged: z.enum(["true", "false"]).optional().transform((value) => value !== "false"),
  year_from: z.coerce.number().int().min(1800).max(2100).optional(),
  year_to: z.coerce.number().int().min(1800).max(2100).optional(),
}).refine((value) => !value.year_from || !value.year_to || value.year_from <= value.year_to, {
  message: "year_from must not be after year_to",
  path: ["year_to"],
});

export const recentRecommendationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(12).default(6),
});

export const itemIdParamSchema = z.object({ id: z.string().uuid("Item id must be a UUID") });
