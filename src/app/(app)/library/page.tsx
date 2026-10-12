import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { auth } from "@/auth";

async function LibraryGreeting() {
  noStore();
  const session = await auth();
  return (
    <p className="text-muted-foreground text-sm">
      Welcome back, {session?.user?.name || session?.user?.email || "User"}. Here is your tracked media catalog.
    </p>
  );
}

function LibraryGreetingSkeleton() {
  return <div className="h-5 w-64 animate-pulse rounded bg-muted/50" />;
}

export default function LibraryPage() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">My Library</h1>
        <Suspense fallback={<LibraryGreetingSkeleton />}>
          <LibraryGreeting />
        </Suspense>
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-border/80 p-12 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-xl mb-3">
          📚
        </div>
        <h3 className="text-base font-semibold">Your library is empty</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Start searching for movies, TV shows, and books to add to your library.
        </p>
      </div>
    </div>
  );
}
