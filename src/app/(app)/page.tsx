import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { RecommendationShelves } from "@/components/recommendation-shelves";

async function HeroActions() {
  await connection();
  const session = await auth();

  if (session?.user) {
    return (
      <>
        <Link href="/library">
          <Button size="lg" className="h-11 px-6">
            Go to Your Library
          </Button>
        </Link>
        <Link href="/search">
          <Button size="lg" variant="outline" className="h-11 px-6">
            Search Catalog
          </Button>
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href="/login">
        <Button size="lg" className="h-11 px-6">
          Get Started Free
        </Button>
      </Link>
      <Link href="/search">
        <Button size="lg" variant="outline" className="h-11 px-6">
          Explore Media
        </Button>
      </Link>
    </>
  );
}

function HeroActionsSkeleton() {
  return (
    <div className="flex gap-3">
      <div className="h-11 w-36 animate-pulse rounded-lg bg-muted/60" />
      <div className="h-11 w-36 animate-pulse rounded-lg bg-muted/40" />
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-12 sm:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-card via-muted/30 to-card p-8 sm:p-14 shadow-sm">
        <div className="max-w-2xl space-y-4">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Universal Media Tracker
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            Track everything you watch and read.
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            One unified place for movies, TV shows, and books. Discover connections across media powered by vector recommendations.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-4">
            <Suspense fallback={<HeroActionsSkeleton />}>
              <HeroActions />
            </Suspense>
          </div>
        </div>
      </section>

      <section className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 font-bold mb-4">
            🎬
          </div>
          <h3 className="font-semibold text-lg">Movies & TV</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Search millions of titles via TMDB. Log what you watched, rate with stars, and capture your thoughts.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 font-bold mb-4">
            📚
          </div>
          <h3 className="font-semibold text-lg">Books</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Track novels, non-fiction, and audiobooks with Open Library. Organize reading lists seamlessly alongside watchlists.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 font-bold mb-4">
            ✨
          </div>
          <h3 className="font-semibold text-lg">Vector Intelligence</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            High-dimensional embeddings connect themes, tone, and creators across movies, shows, and books.
          </p>
        </div>
      </section>

      <Suspense fallback={<div className="mt-12 h-48 animate-pulse rounded-2xl bg-muted/40" />}>
        <RecommendationShelves />
      </Suspense>
    </div>
  );
}
