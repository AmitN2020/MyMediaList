import { z } from "zod";

export const itemStatusSchema = z.enum([
  "planned",
  "in_progress",
  "completed",
  "dropped",
]);

export type ItemStatus = z.infer<typeof itemStatusSchema>;

export const addToLibrarySchema = z.object({
  itemId: z.string().uuid("itemId must be a UUID"),
  status: itemStatusSchema.default("planned"),
  rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(2000).optional(),
});

export type AddToLibraryRequest = z.infer<typeof addToLibrarySchema>;

export const updateLibrarySchema = z
  .object({
    status: itemStatusSchema.optional(),
    rating: z.number().int().min(1).max(5).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateLibraryRequest = z.infer<typeof updateLibrarySchema>;

export const libraryQuerySchema = z.object({
  type: z.enum(["movie", "tv", "book"]).optional(),
  status: itemStatusSchema.optional(),
  sort: z
    .enum(["updated_at", "rating", "title", "year"])
    .default("updated_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type LibraryQuery = z.infer<typeof libraryQuerySchema>;

export const searchQuerySchema = z.object({
  q: z.string().min(1, "Query is required").max(200),
  type: z.enum(["all", "movie", "tv", "book"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
