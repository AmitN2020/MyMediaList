export type ItemType = "movie" | "tv" | "book";
export type ItemSource = "tmdb" | "openlibrary";

export type NormalizedItem = {
  type: ItemType;
  source: ItemSource;
  externalId: string;
  title: string;
  description?: string;
  year?: number;
  genres: string[];
  keywords: string[];
  creators: string[];
  coverUrl?: string;
  metadata?: Record<string, unknown>;
};

export type SearchOptions = {
  type?: ItemType;
  page?: number;
};

export interface Provider {
  search(query: string, opts?: SearchOptions): Promise<NormalizedItem[]>;
  getById(externalId: string, type: ItemType): Promise<NormalizedItem | null>;
}
