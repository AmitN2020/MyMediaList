export type EmbeddableItem = {
  type: "movie" | "tv" | "book";
  title: string;
  year?: number | null;
  creators?: string[] | null;
  genres?: string[] | null;
  keywords?: string[] | null;
  description?: string | null;
};

const MAX_DESCRIPTION_LENGTH = 1500;

function formatType(type: "movie" | "tv" | "book"): string {
  switch (type) {
    case "movie":
      return "Movie";
    case "tv":
      return "TV";
    case "book":
      return "Book";
  }
}

/**
 * Builds a deterministic text representation of a media item for embedding generation.
 * Format:
 *   {Type}: {title} ({year})
 *   By: {creators}
 *   Genres: {genres}
 *   Themes: {keywords}
 *   {description}
 *
 * Missing fields are omitted cleanly.
 * Descriptions are capped at ~1,500 characters.
 */
export function buildItemText(item: EmbeddableItem): string {
  const parts: string[] = [];

  // Header: {Type}: {title} ({year})
  const typeStr = formatType(item.type);
  const yearStr = item.year ? ` (${item.year})` : "";
  parts.push(`${typeStr}: ${item.title.trim()}${yearStr}`);

  // By: {creators}
  if (item.creators && item.creators.length > 0) {
    const validCreators = item.creators.map((c) => c.trim()).filter(Boolean);
    if (validCreators.length > 0) {
      parts.push(`By: ${validCreators.join(", ")}`);
    }
  }

  // Genres: {genres}
  if (item.genres && item.genres.length > 0) {
    const validGenres = item.genres.map((g) => g.trim()).filter(Boolean);
    if (validGenres.length > 0) {
      parts.push(`Genres: ${validGenres.join(", ")}`);
    }
  }

  // Themes: {keywords}
  if (item.keywords && item.keywords.length > 0) {
    const validKeywords = item.keywords.map((k) => k.trim()).filter(Boolean);
    if (validKeywords.length > 0) {
      parts.push(`Themes: ${validKeywords.join(", ")}`);
    }
  }

  // {description} (truncated to 1500 chars)
  if (item.description) {
    const trimmed = item.description.trim();
    if (trimmed.length > 0) {
      const truncated =
        trimmed.length > MAX_DESCRIPTION_LENGTH
          ? trimmed.slice(0, MAX_DESCRIPTION_LENGTH).trimEnd() + "..."
          : trimmed;
      parts.push(truncated);
    }
  }

  return parts.join("\n");
}
