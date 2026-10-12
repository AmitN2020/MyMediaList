export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  model: string;
  dimensions: number;
}

export type GeminiEmbeddingOptions = {
  apiKey?: string;
  model?: string;
  dimensions?: number;
  batchSize?: number;
  delayBetweenBatchesMs?: number;
  maxRetries?: number;
  fetchFn?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
};

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  private readonly apiKey: string;
  private readonly batchSize: number;
  private readonly delayBetweenBatchesMs: number;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(options: GeminiEmbeddingOptions = {}) {
    this.apiKey =
      options.apiKey !== undefined
        ? options.apiKey
        : process.env.GEMINI_API_KEY || "";
    this.model = options.model || "models/gemini-embedding-001";
    this.dimensions = options.dimensions || 768;
    this.batchSize = options.batchSize || 50;
    this.delayBetweenBatchesMs = options.delayBetweenBatchesMs || 200;
    this.maxRetries = options.maxRetries ?? 5;
    this.fetchFn = options.fetchFn || globalThis.fetch;
    this.sleep = options.sleep || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!this.apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in your environment.",
      );
    }

    const results: number[][] = [];
    const modelPath = this.model.startsWith("models/")
      ? this.model
      : `models/${this.model}`;

    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);

      const batchVectors = await this.embedBatchWithRetry(modelPath, batch);
      results.push(...batchVectors);

      if (i + this.batchSize < texts.length && this.delayBetweenBatchesMs > 0) {
        await this.sleep(this.delayBetweenBatchesMs);
      }
    }

    return results;
  }

  private async embedBatchWithRetry(
    modelPath: string,
    batch: string[],
  ): Promise<number[][]> {
    let attempt = 0;
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:batchEmbedContents?key=${this.apiKey}`;

    const payload = {
      requests: batch.map((text) => ({
        model: modelPath,
        content: {
          parts: [{ text }],
        },
        outputDimensionality: this.dimensions,
      })),
    };

    while (attempt <= this.maxRetries) {
      attempt++;
      try {
        const response = await this.fetchFn(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const status = response.status;
          const errorText = await response.text();

          // Retry on 429 (Rate Limit) or 5xx server errors
          if ((status === 429 || status >= 500) && attempt <= this.maxRetries) {
            let backoff = Math.pow(2, attempt) * 1000;
            if (status === 429) {
              const match =
                errorText.match(/retry in ([0-9.]+)s/i) ||
                errorText.match(/"retryDelay":\s*"([0-9]+)s"/i);
              if (match?.[1]) {
                backoff = Math.ceil(parseFloat(match[1]) + 2) * 1000;
              } else {
                backoff = 32000;
              }
              console.log(
                `[Gemini Rate Limit] Pausing for ${Math.round(backoff / 1000)}s before retry ${attempt}/${this.maxRetries}...`,
              );
            }
            await this.sleep(backoff);
            continue;
          }

          throw new Error(
            `Gemini API embedding error (${status}): ${errorText}`,
          );
        }

        const data = (await response.json()) as {
          embeddings?: Array<{ values: number[] }>;
        };

        if (!data.embeddings || data.embeddings.length !== batch.length) {
          throw new Error(
            `Unexpected Gemini embedding response: expected ${batch.length} vectors, got ${data.embeddings?.length ?? 0}`,
          );
        }

        return data.embeddings.map((e) => e.values);
      } catch (err: unknown) {
        if (attempt > this.maxRetries) {
          throw err instanceof Error ? err : new Error(String(err));
        }
        const backoff = Math.pow(2, attempt) * 500 + Math.random() * 200;
        await this.sleep(backoff);
      }
    }

    throw new Error("Failed to embed batch after multiple attempts");
  }
}

let defaultProvider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (!defaultProvider) {
    defaultProvider = new GeminiEmbeddingProvider();
  }
  return defaultProvider;
}

export function setEmbeddingProvider(provider: EmbeddingProvider | null): void {
  defaultProvider = provider;
}
