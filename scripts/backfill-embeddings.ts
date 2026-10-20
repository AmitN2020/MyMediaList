try {
  process.loadEnvFile?.();
} catch {}

import { isNull, sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { items } from "../src/db/schema";
import { buildItemText } from "../src/server/embeddings/build-text";
import { getEmbeddingProvider } from "../src/server/embeddings/client";

async function main() {
  console.log("=== Backfill Embeddings Script ===");

  const provider = getEmbeddingProvider();
  console.log(`Using provider model: ${provider.model} (${provider.dimensions} dimensions)`);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(items)
    .where(isNull(items.embedding));

  const totalPending = Number(countRow?.count ?? 0);
  console.log(`Items pending embedding: ${totalPending}`);

  if (totalPending === 0) {
    console.log("No items need embedding. Everything is up to date!");
    return;
  }

  const BATCH_SIZE = 50;
  let processed = 0;

  while (true) {
    const pendingItems = await db.query.items.findMany({
      where: isNull(items.embedding),
      limit: BATCH_SIZE,
    });

    if (pendingItems.length === 0) break;

    console.log(
      `Processing batch of ${pendingItems.length} items (${processed + 1} to ${processed + pendingItems.length} of ${totalPending})...`,
    );

    const texts = pendingItems.map((item) => buildItemText(item));
    const vectors = await provider.embed(texts);

    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      const vector = vectors[i];
      if (item && vector) {
        await db
          .update(items)
          .set({
            embedding: vector,
            embeddingModel: provider.model,
            updatedAt: new Date(),
          })
          .where(sql`${items.id} = ${item.id}`);
      }
    }

    processed += pendingItems.length;
    console.log(`Successfully embedded ${processed} / ${totalPending} items.`);

    // Delay between batches to respect rate limits
    if (processed < totalPending) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`\n🎉 Finished! Total items embedded in this run: ${processed}`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
