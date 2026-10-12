export type FetchFn = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export async function getJson(
  url: string,
  options: { fetch?: FetchFn; headers?: HeadersInit } = {},
): Promise<
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; data: unknown }
> {
  const fetchFn = options.fetch ?? fetch;
  const response = await fetchFn(url, {
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    return { ok: false, status: response.status, data };
  }

  return { ok: true, status: response.status, data };
}

export function yearFromDate(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const year = Number.parseInt(value.slice(0, 4), 10);
  return Number.isFinite(year) && year > 0 ? year : undefined;
}

export function uniqueNonEmpty(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}
