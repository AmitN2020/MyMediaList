import { z } from "zod";

export const itemTypeSchema = z.enum(["movie", "tv", "book"]);
export const itemSourceSchema = z.enum(["tmdb", "openlibrary"]);

export const cacheItemRequestSchema = z
  .object({
    source: itemSourceSchema,
    externalId: z.string().trim().min(1, "externalId is required"),
    type: itemTypeSchema,
  })
  .superRefine((value, ctx) => {
    if (value.source === "tmdb" && value.type === "book") {
      ctx.addIssue({
        code: "custom",
        message: "TMDB does not provide books",
        path: ["type"],
      });
    }
    if (value.source === "openlibrary" && value.type !== "book") {
      ctx.addIssue({
        code: "custom",
        message: "Open Library only provides books",
        path: ["type"],
      });
    }
  });

export type CacheItemRequest = z.infer<typeof cacheItemRequestSchema>;
