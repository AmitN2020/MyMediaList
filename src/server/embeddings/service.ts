import { eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { items } from "@/db/schema";
import { buildItemText } from "./build-text";
import { getEmbeddingProvider, type EmbeddingProvider } from "./client";

/**
 * Computes and stores an embedding vector for a single catalog item if not already embedded.
 * Returns true if embedded, false if already has embedding or item not found.
 */
export async function embedItem(
  itemId: string,
  provider: EmbeddingProvider = getEmbeddingProvider(),
): Promise<boolean> {
  const item = await db.query.items.findFirst({
    where: eq(items.id, itemId),
  });
  if (!item || item.embedding !== null) return false;

  const text = buildItemText(item);
  const [vector] = await provider.embed([text]);
  if (!vector) return false;

  await db
    .update(items)
    .set({
      embedding: vector,
      embeddingModel: provider.model,
      updatedAt: new Date(),
    })
    .where(eq(items.id, itemId));

  return true;
}

/**
 * Processes a batch of catalog items whose embeddings are NULL.
 * Returns the number of items successfully processed.
 */
export async function embedPendingItems(
  batchSize = 50,
  provider: EmbeddingProvider = getEmbeddingProvider(),
): Promise<number> {
  const pending = await db.query.items.findMany({
    where: isNull(items.embedding),
    limit: batchSize,
  });

  if (pending.length === 0) return 0;

  const texts = pending.map((item) => buildItemText(item));
  const vectors = await provider.embed(texts);

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    const vector = vectors[i];
    if (item && vector) {
      await db
        .update(items)
        .set({
          embedding: vector,
          embeddingModel: provider.model,
          updatedAt: new Date(),
        })
        .where(eq(items.id, item.id));
    }
  }

  return pending.length;
}
