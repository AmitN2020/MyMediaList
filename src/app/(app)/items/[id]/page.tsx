import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, Film, Tv, ArrowLeft } from "lucide-react";
import { db } from "@/db/client";
import { items } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getUserItem } from "@/server/library";
import { STATUS_LABELS } from "@/components/status-select";
import { getSimilarItems } from "@/server/recs/recommendations";

interface PageProps {
  params: Promise<{ id: string }>;
}

const TYPE_ICON = { movie: Film, tv: Tv, book: BookOpen };
const TYPE_LABEL = { movie: "Movie", tv: "TV Show", book: "Book" };

function ItemDetailSkeleton() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <div className="h-5 w-28 animate-pulse rounded bg-muted" />
      <div className="mt-8 flex flex-col gap-8 sm:flex-row">
        <div className="aspect-[2/3] w-full animate-pulse rounded-2xl bg-muted sm:w-48 lg:w-56" />
        <div className="flex-1 space-y-4">
          <div className="h-6 w-24 animate-pulse rounded bg-muted" />
          <div className="h-10 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-24 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

async function ItemDetails({ params }: PageProps) {
  const { id } = await params;

  const item = await db.query.items.findFirst({ where: eq(items.id, id) });
  if (!item) notFound();

  const session = await auth();
  const userItem = session?.user?.id
    ? await getUserItem(session.user.id, item.id)
    : null;
  const similar = session?.user?.id
    ? await getSimilarItems(item.id, session.user.id)
    : [];

  const Icon = TYPE_ICON[item.type];
  const metadata = item.metadata as Record<string, unknown> | null;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <Link
        href="/library"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to Library
      </Link>

      <div className="flex flex-col gap-8 sm:flex-row">
        {/* Cover */}
        <div className="w-full sm:w-48 lg:w-56 shrink-0">
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-border/60 bg-muted shadow-sm">
            {item.coverUrl ? (
              <Image
                src={item.coverUrl}
                alt={`Cover for ${item.title}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 90vw, 224px"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground/30">
                <Icon className="size-16" />
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-1 flex-col gap-4">
          {/* Type badge */}
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <Icon className="size-3.5" />
            {TYPE_LABEL[item.type]}
          </span>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{item.title}</h1>

          <p className="text-sm text-muted-foreground">
            {item.year ?? "Unknown year"}
            {item.creators.length > 0 && (
              <> · {item.creators.join(", ")}</>
            )}
          </p>

          {/* Metadata extras */}
          {metadata && (
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {typeof metadata.runtime === "number" && (
                <span>{metadata.runtime} min</span>
              )}
              {typeof metadata.seasons === "number" && (
                <span>{metadata.seasons} season{metadata.seasons !== 1 ? "s" : ""}</span>
              )}
              {typeof metadata.episodes === "number" && (
                <span>{metadata.episodes} episodes</span>
              )}
            </div>
          )}

          {/* Genres */}
          {item.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.genres.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-border/60 bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {item.description && (
            <p className="text-sm leading-relaxed text-foreground/80 max-w-prose">
              {item.description}
            </p>
          )}

          {/* User status */}
          {userItem && (
            <div className="mt-2 rounded-xl border border-border/60 bg-muted/30 p-4">
              <h2 className="mb-3 text-sm font-semibold">Your Tracking</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd className="mt-0.5 font-medium">
                    {STATUS_LABELS[userItem.status]}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Rating</dt>
                  <dd className="mt-0.5 font-medium">
                    {userItem.rating !== null ? `${userItem.rating} / 5` : "—"}
                  </dd>
                </div>
                {userItem.notes && (
                  <div className="col-span-full">
                    <dt className="text-xs text-muted-foreground">Notes</dt>
                    <dd className="mt-0.5 text-muted-foreground">{userItem.notes}</dd>
                  </div>
                )}
              </dl>
              <Link
                href="/library"
                className="mt-3 inline-block text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Edit in library →
              </Link>
            </div>
          )}

          {!userItem && session?.user && (
            <Link
              href="/search"
              id="add-to-library-from-detail"
              className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Add to Library
            </Link>
          )}
        </div>
      </div>

      {similar && similar.length > 0 && (
        <section className="mt-12 border-t border-border/60 pt-8">
          <h2 className="text-xl font-semibold">Similar items</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((match) => (
              <Link key={match.id} href={`/items/${match.id}`} className="rounded-xl border border-border/60 bg-card p-4 transition-shadow hover:shadow-sm">
                <p className="text-sm font-semibold">{match.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{match.type} · {match.year ?? "Unknown year"}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function ItemDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<ItemDetailSkeleton />}>
      <ItemDetails params={params} />
    </Suspense>
  );
}
