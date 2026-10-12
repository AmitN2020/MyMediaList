import { z } from "zod";
import { getJson, uniqueNonEmpty, yearFromDate, type FetchFn } from "./http";
import type { ItemType, NormalizedItem, Provider, SearchOptions } from "./types";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const DEFAULT_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/";
const POSTER_SIZE = "w500";

const namedSchema = z.object({
  name: z.string(),
});

const crewMemberSchema = z.object({
  job: z.string().optional(),
  name: z.string(),
});

const tmdbSearchResultSchema = z.object({
  id: z.number(),
  media_type: z.string().optional(),
  title: z.string().optional(),
  name: z.string().optional(),
  overview: z.string().nullable().optional(),
  poster_path: z.string().nullable().optional(),
  release_date: z.string().nullable().optional(),
  first_air_date: z.string().nullable().optional(),
});

const tmdbSearchResponseSchema = z.object({
  results: z.array(tmdbSearchResultSchema).default([]),
});

const tmdbMovieDetailsSchema = z.object({
  id: z.number(),
  title: z.string(),
  overview: z.string().nullable().optional(),
  poster_path: z.string().nullable().optional(),
  release_date: z.string().nullable().optional(),
  runtime: z.number().nullable().optional(),
  genres: z.array(namedSchema).default([]),
  credits: z
    .object({
      crew: z.array(crewMemberSchema).default([]),
    })
    .optional(),
  keywords: z
    .object({
      keywords: z.array(namedSchema).default([]),
    })
    .optional(),
});

const tmdbTvDetailsSchema = z.object({
  id: z.number(),
  name: z.string(),
  overview: z.string().nullable().optional(),
  poster_path: z.string().nullable().optional(),
  first_air_date: z.string().nullable().optional(),
  number_of_seasons: z.number().nullable().optional(),
  number_of_episodes: z.number().nullable().optional(),
  genres: z.array(namedSchema).default([]),
  created_by: z.array(namedSchema).default([]),
  credits: z
    .object({
      crew: z.array(crewMemberSchema).default([]),
    })
    .optional(),
  keywords: z
    .object({
      results: z.array(namedSchema).default([]),
    })
    .optional(),
});

const tmdbConfigurationSchema = z.object({
  images: z
    .object({
      secure_base_url: z.string().optional(),
    })
    .optional(),
});

export function buildTmdbPosterUrl(
  posterPath: string | null | undefined,
  imageBaseUrl = DEFAULT_IMAGE_BASE_URL,
): string | undefined {
  if (!posterPath) return undefined;
  const base = imageBaseUrl.endsWith("/") ? imageBaseUrl : `${imageBaseUrl}/`;
  return `${base}${POSTER_SIZE}${posterPath}`;
}

function optionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function directorsFromCrew(crew: Array<{ job?: string; name: string }>): string[] {
  return uniqueNonEmpty(
    crew.filter((member) => member.job === "Director").map((member) => member.name),
  );
}

export function normalizeTmdbSearchResult(
  raw: unknown,
  imageBaseUrl = DEFAULT_IMAGE_BASE_URL,
): NormalizedItem | null {
  const parsed = tmdbSearchResultSchema.safeParse(raw);
  if (!parsed.success) return null;

  const result = parsed.data;
  const mediaType = result.media_type;
  if (mediaType !== "movie" && mediaType !== "tv") return null;

  const title = mediaType === "movie" ? result.title : result.name;
  if (!title?.trim()) return null;

  return {
    type: mediaType,
    source: "tmdb",
    externalId: String(result.id),
    title: title.trim(),
    description: optionalText(result.overview ?? undefined),
    year: yearFromDate(result.release_date ?? result.first_air_date ?? undefined),
    genres: [],
    keywords: [],
    creators: [],
    coverUrl: buildTmdbPosterUrl(result.poster_path, imageBaseUrl),
  };
}

export function normalizeTmdbMovieDetails(
  raw: unknown,
  imageBaseUrl = DEFAULT_IMAGE_BASE_URL,
): NormalizedItem | null {
  const parsed = tmdbMovieDetailsSchema.safeParse(raw);
  if (!parsed.success) return null;

  const movie = parsed.data;
  return {
    type: "movie",
    source: "tmdb",
    externalId: String(movie.id),
    title: movie.title.trim(),
    description: optionalText(movie.overview ?? undefined),
    year: yearFromDate(movie.release_date ?? undefined),
    genres: uniqueNonEmpty(movie.genres.map((genre) => genre.name)),
    keywords: uniqueNonEmpty(movie.keywords?.keywords.map((keyword) => keyword.name) ?? []),
    creators: directorsFromCrew(movie.credits?.crew ?? []),
    coverUrl: buildTmdbPosterUrl(movie.poster_path, imageBaseUrl),
    metadata: {
      runtime: movie.runtime ?? undefined,
    },
  };
}

export function normalizeTmdbTvDetails(
  raw: unknown,
  imageBaseUrl = DEFAULT_IMAGE_BASE_URL,
): NormalizedItem | null {
  const parsed = tmdbTvDetailsSchema.safeParse(raw);
  if (!parsed.success) return null;

  const show = parsed.data;
  const createdBy = uniqueNonEmpty(show.created_by.map((person) => person.name));
  const directors = directorsFromCrew(show.credits?.crew ?? []);

  return {
    type: "tv",
    source: "tmdb",
    externalId: String(show.id),
    title: show.name.trim(),
    description: optionalText(show.overview ?? undefined),
    year: yearFromDate(show.first_air_date ?? undefined),
    genres: uniqueNonEmpty(show.genres.map((genre) => genre.name)),
    keywords: uniqueNonEmpty(show.keywords?.results.map((keyword) => keyword.name) ?? []),
    creators: uniqueNonEmpty([...createdBy, ...directors]),
    coverUrl: buildTmdbPosterUrl(show.poster_path, imageBaseUrl),
    metadata: {
      seasons: show.number_of_seasons ?? undefined,
      episodes: show.number_of_episodes ?? undefined,
    },
  };
}

export class TmdbProvider implements Provider {
  private readonly apiKey: string;
  private readonly fetchFn: FetchFn;
  private imageBaseUrl: string | null;

  constructor(options: { apiKey?: string; fetch?: FetchFn; imageBaseUrl?: string } = {}) {
    this.apiKey = options.apiKey ?? process.env.TMDB_API_KEY ?? "";
    this.fetchFn = options.fetch ?? fetch;
    this.imageBaseUrl = options.imageBaseUrl ?? null;
  }

  async search(query: string, opts: SearchOptions = {}): Promise<NormalizedItem[]> {
    if (opts.type === "book") return [];

    const url = new URL(`${TMDB_BASE_URL}/search/multi`);
    url.searchParams.set("query", query);
    url.searchParams.set("include_adult", "false");
    url.searchParams.set("page", String(opts.page ?? 1));
    this.applyApiKey(url);

    const response = await getJson(url.toString(), { fetch: this.fetchFn });
    if (!response.ok) return [];

    const payload = tmdbSearchResponseSchema.safeParse(response.data);
    if (!payload.success) return [];

    const imageBaseUrl = await this.getImageBaseUrl();
    return payload.data.results
      .map((result) => normalizeTmdbSearchResult(result, imageBaseUrl))
      .filter((item): item is NormalizedItem => item !== null)
      .filter((item) => !opts.type || item.type === opts.type);
  }

  async getById(externalId: string, type: ItemType): Promise<NormalizedItem | null> {
    if (type === "book") return null;

    const path = type === "movie" ? "movie" : "tv";
    const url = new URL(`${TMDB_BASE_URL}/${path}/${externalId}`);
    url.searchParams.set("append_to_response", "credits,keywords");
    this.applyApiKey(url);

    const response = await getJson(url.toString(), { fetch: this.fetchFn });
    if (!response.ok) return null;

    const imageBaseUrl = await this.getImageBaseUrl();
    return type === "movie"
      ? normalizeTmdbMovieDetails(response.data, imageBaseUrl)
      : normalizeTmdbTvDetails(response.data, imageBaseUrl);
  }

  private applyApiKey(url: URL): void {
    if (!this.apiKey) {
      throw new Error("TMDB_API_KEY is not configured");
    }
    url.searchParams.set("api_key", this.apiKey);
  }

  private async getImageBaseUrl(): Promise<string> {
    if (this.imageBaseUrl) return this.imageBaseUrl;

    try {
      const url = new URL(`${TMDB_BASE_URL}/configuration`);
      this.applyApiKey(url);
      const response = await getJson(url.toString(), { fetch: this.fetchFn });
      if (response.ok) {
        const parsed = tmdbConfigurationSchema.safeParse(response.data);
        const configured = parsed.success
          ? parsed.data.images?.secure_base_url
          : undefined;
        this.imageBaseUrl = configured || DEFAULT_IMAGE_BASE_URL;
      } else {
        this.imageBaseUrl = DEFAULT_IMAGE_BASE_URL;
      }
    } catch {
      this.imageBaseUrl = DEFAULT_IMAGE_BASE_URL;
    }

    return this.imageBaseUrl;
  }
}
