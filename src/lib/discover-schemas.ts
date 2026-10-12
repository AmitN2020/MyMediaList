import { z } from "zod";

export const discoverQuerySchema = z.object({
  mode: z.enum(["text", "semantic"]).default("text"),
  q: z.string().min(1, "Query is required").max(300),
  type: z.enum(["all", "movie", "tv", "book"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
  exclude_logged: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export type DiscoverQuery = z.infer<typeof discoverQuerySchema>;
