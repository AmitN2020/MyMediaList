import { z } from "zod";
import { getJson, uniqueNonEmpty, yearFromDate, type FetchFn } from "./http";
import type { ItemType, NormalizedItem, Provider, SearchOptions } from "./types";

const OPEN_LIBRARY_BASE_URL = "https://openlibrary.org";
const OPEN_LIBRARY_COVERS_URL = "https://covers.openlibrary.org/b/id";
const USER_AGENT = "MyMediaList/0.1 (local hobby project)";

const descriptionSchema = z.union([
  z.string(),
  z.object({
    value: z.string(),
  }),
]);

const searchDocSchema = z.object({
  key: z.string(),
  title: z.string().optional(),
  author_name: z.array(z.string()).optional(),
  first_publish_year: z.number().nullable().optional(),
  cover_i: z.number().nullable().optional(),
  subject: z.array(z.string()).optional(),
});

const searchResponseSchema = z.object({
  docs: z.array(searchDocSchema).default([]),
});

const workAuthorRefSchema = z.object({
  author: z
    .object({
      key: z.string(),
    })
    .optional(),
  key: z.string().optional(),
});

const workDetailsSchema = z.object({
  key: z.string().optional(),
  title: z.string(),
  description: descriptionSchema.nullable().optional(),
  subjects: z.array(z.string()).optional(),
  covers: z.array(z.number()).optional(),
  authors: z.array(workAuthorRefSchema).optional(),
  first_publish_date: z.string().nullable().optional(),
});

const authorDetailsSchema = z.object({
  name: z.string().optional(),
});

export function parseOpenLibraryDescription(
  description: unknown,
): string | undefined {
  const parsed = descriptionSchema.safeParse(description);
  if (!parsed.success) return undefined;
  const value = typeof parsed.data === "string" ? parsed.data : parsed.data.value;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function buildOpenLibraryCoverUrl(
  coverId: number | null | undefined,
): string | undefined {
  if (coverId == null || coverId <= 0) return undefined;
  return `${OPEN_LIBRARY_COVERS_URL}/${coverId}-L.jpg`;
}

export function normalizeWorkKey(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/OL\d+W/i);
  return match ? match[0].toUpperCase() : trimmed.replace(/^\/works\//, "");
}

function splitSubjects(subjects: string[]): { genres: string[]; keywords: string[] } {
  const unique = uniqueNonEmpty(subjects);
  return {
    genres: unique.slice(0, 5),
    keywords: unique.slice(5),
  };
}

function optionalYear(value: number | null | undefined): number | undefined {
  if (value == null || !Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

export function normalizeOpenLibrarySearchDoc(raw: unknown): NormalizedItem | null {
  const parsed = searchDocSchema.safeParse(raw);
  if (!parsed.success) return null;

  const doc = parsed.data;
  const title = doc.title?.trim();
  if (!title) return null;

  const { genres, keywords } = splitSubjects(doc.subject ?? []);

  return {
    type: "book",
    source: "openlibrary",
    externalId: normalizeWorkKey(doc.key),
    title,
    year: optionalYear(doc.first_publish_year),
    genres,
    keywords,
    creators: uniqueNonEmpty(doc.author_name ?? []),
    coverUrl: buildOpenLibraryCoverUrl(doc.cover_i),
  };
}

export function normalizeOpenLibraryWork(
  raw: unknown,
  options: { authors?: string[]; coverId?: number; year?: number } = {},
): NormalizedItem | null {
  const parsed = workDetailsSchema.safeParse(raw);
  if (!parsed.success) return null;

  const work = parsed.data;
  const { genres, keywords } = splitSubjects(work.subjects ?? []);
  const coverId = options.coverId ?? work.covers?.[0];

  return {
    type: "book",
    source: "openlibrary",
    externalId: normalizeWorkKey(work.key ?? ""),
    title: work.title.trim(),
    description: parseOpenLibraryDescription(work.description),
    year: options.year ?? yearFromDate(work.first_publish_date ?? undefined),
    genres,
    keywords,
    creators: uniqueNonEmpty(options.authors ?? []),
    coverUrl: buildOpenLibraryCoverUrl(coverId),
  };
}

export class OpenLibraryProvider implements Provider {
  private readonly fetchFn: FetchFn;

  constructor(options: { fetch?: FetchFn } = {}) {
    this.fetchFn = options.fetch ?? fetch;
  }

  async search(query: string, opts: SearchOptions = {}): Promise<NormalizedItem[]> {
    if (opts.type && opts.type !== "book") return [];

    const url = new URL(`${OPEN_LIBRARY_BASE_URL}/search.json`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "20");
    url.searchParams.set("page", String(opts.page ?? 1));

    const response = await this.request(url.toString());
    if (!response.ok) return [];

    const payload = searchResponseSchema.safeParse(response.data);
    if (!payload.success) return [];

    return payload.data.docs
      .map((doc) => normalizeOpenLibrarySearchDoc(doc))
      .filter((item): item is NormalizedItem => item !== null);
  }

  async getById(externalId: string, type: ItemType): Promise<NormalizedItem | null> {
    if (type !== "book") return null;

    const workId = normalizeWorkKey(externalId);
    const response = await this.request(`${OPEN_LIBRARY_BASE_URL}/works/${workId}.json`);
    if (!response.ok) return null;

    const parsed = workDetailsSchema.safeParse(response.data);
    if (!parsed.success) return null;

    const authors = await this.resolveAuthorNames(parsed.data.authors ?? []);
    return normalizeOpenLibraryWork(parsed.data, { authors });
  }

  private async resolveAuthorNames(
    refs: Array<{ author?: { key: string }; key?: string }>,
  ): Promise<string[]> {
    const names: string[] = [];
    for (const ref of refs.slice(0, 5)) {
      const key = ref.author?.key ?? ref.key;
      if (!key) continue;
      const authorId = key.replace(/^\/authors\//, "");
      const response = await this.request(
        `${OPEN_LIBRARY_BASE_URL}/authors/${authorId}.json`,
      );
      if (!response.ok) continue;
      const parsed = authorDetailsSchema.safeParse(response.data);
      if (parsed.success && parsed.data.name) {
        names.push(parsed.data.name);
      }
    }
    return uniqueNonEmpty(names);
  }

  private request(url: string) {
    return getJson(url, {
      fetch: this.fetchFn,
      headers: { "User-Agent": USER_AGENT },
    });
  }
}
