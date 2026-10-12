import Link from "next/link";
import { connection } from "next/server";
import { auth } from "@/auth";
import { getRecentRecommendations, getRecommendations, type RecentRecommendation, type RecommendationResult } from "@/server/recs/recommendations";
import type { ItemType } from "@/server/providers/types";

function RecommendationLinks({ items, becauseOf }: { items: Array<RecommendationResult | RecentRecommendation>; becauseOf?: boolean }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => (
    <Link key={item.id} href={`/items/${item.id}`} className="rounded-xl border border-border/60 bg-card p-4 transition-shadow hover:shadow-sm">
      <p className="text-sm font-semibold">{item.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{item.year ?? "Unknown year"}{item.creators[0] ? ` · ${item.creators[0]}` : ""}</p>
      {becauseOf && "becauseOf" in item && <p className="mt-2 text-xs text-primary">Because you watched/read {item.becauseOf.title}</p>}
    </Link>
  ))}</div>;
}

const TYPE_LABEL: Record<ItemType, string> = { movie: "Movies", tv: "TV shows", book: "Books" };

export async function RecommendationShelves() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) return null;

  const [general, recent] = await Promise.all([
    getRecommendations(session.user.id),
    getRecentRecommendations(session.user.id),
  ]);

  return <section className="mt-12 space-y-10">
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Recommended for you</h2>
      <p className="mt-1 text-sm text-muted-foreground">{general.coldStart ? "Rate a few more titles to personalize these picks." : "Based on the titles you have enjoyed."}</p>
      <div className="mt-4"><RecommendationLinks items={general.items} /></div>
    </div>
    {(["movie", "tv", "book"] as const).map((type) => recent[type].length > 0 && <div key={type}>
      <h2 className="text-xl font-semibold">Because you recently watched/read · {TYPE_LABEL[type]}</h2>
      <div className="mt-4"><RecommendationLinks items={recent[type]} becauseOf /></div>
    </div>)}
  </section>;
}
