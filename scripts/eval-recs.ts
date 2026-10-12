process.loadEnvFile?.();

import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { users } from "../src/db/schema";
import { groupHitsByType, searchCachedItemsSemantic } from "../src/server/recs/search";

const queries = [
  "cozy mystery with a clever detective",
  "hopeful space exploration",
  "coming of age fantasy adventure",
  "political historical drama",
  "quiet literary story about family",
  "tense psychological thriller",
  "funny workplace comedy",
  "epic science fiction rebellion",
  "warm baking and friendship story",
  "supernatural small town mystery",
];

async function main() {
  const demoUser = await db.query.users.findFirst({
    where: eq(users.email, "demo@example.com"),
    columns: { id: true },
  });
  if (!demoUser) throw new Error("Run pnpm seed before evaluating semantic search.");

  for (const query of queries) {
    const results = await searchCachedItemsSemantic(
      { q: query, type: "all", limit: 5, excludeLogged: true },
      demoUser.id,
    );
    const groups = groupHitsByType(results);
    console.log(`\n${query}`);
    for (const type of ["movie", "tv", "book"] as const) {
      console.log(`  ${type}: ${groups[type].map((item) => item.title).join("; ") || "(none)"}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error("Recommendation evaluation failed:", error);
  process.exit(1);
});
