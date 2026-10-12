import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

async function UserMenu() {
  noStore();
  const session = await auth();

  if (!session?.user) {
    return (
      <Link href="/login">
        <Button size="sm">Sign in</Button>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {session.user.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name || "User Avatar"}
            width={32}
            height={32}
            className="size-8 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground">
            {session.user.name ? session.user.name.charAt(0) : "U"}
          </div>
        )}
        <span className="hidden sm:inline-block text-sm font-medium">
          {session.user.name || session.user.email}
        </span>
      </div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <Button variant="outline" size="sm" type="submit">
          Sign out
        </Button>
      </form>
    </div>
  );
}

function UserMenuSkeleton() {
  return <div className="h-8 w-20 animate-pulse rounded-md bg-muted/50" />;
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-lg">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-black text-sm">
              M
            </span>
            <span>MyMediaList</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-foreground">
              Home
            </Link>
            <Link href="/library" className="transition-colors hover:text-foreground">
              Library
            </Link>
            <Link href="/search" className="transition-colors hover:text-foreground">
              Search
            </Link>
            <Link href="/discover" className="transition-colors hover:text-foreground">
              Discover
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
