"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus, Check, Trash2, BookOpen, Tv, Film } from "lucide-react";
import { StatusSelect } from "@/components/status-select";
import { RatingInput } from "@/components/rating-input";
import type { ItemStatus } from "@/lib/library-schemas";
import type { NormalizedItem } from "@/server/providers/types";

// ---------------------------------------------------------------------------
// Shared type for items that may have a DB id (library items) or just
// normalized external data (search results)
// ---------------------------------------------------------------------------
export type CardItem =
  | {
      kind: "search";
      data: NormalizedItem;
    }
  | {
      kind: "library";
      dbItemId: string; // items.id (UUID)
      data: NormalizedItem & { id?: string };
      userStatus: ItemStatus;
      userRating: number | null;
    };

interface ItemCardProps {
  item: CardItem;
  /** Called when user hits "Add" on a search result. Returns the cached item's DB id. */
  onAdd?: (item: NormalizedItem) => Promise<string>;
  /** Called when status changes on a library item */
  onStatusChange?: (dbItemId: string, status: ItemStatus) => Promise<void>;
  /** Called when rating changes on a library item */
  onRatingChange?: (dbItemId: string, rating: number | null) => Promise<void>;
  /** Called when user removes a library item */
  onRemove?: (dbItemId: string) => Promise<void>;
}

const TYPE_ICON = {
  movie: Film,
  tv: Tv,
  book: BookOpen,
};

const TYPE_LABEL = {
  movie: "Movie",
  tv: "TV Show",
  book: "Book",
};

const TYPE_COLOR = {
  movie: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  tv: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  book: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export function ItemCard({
  item,
  onAdd,
  onStatusChange,
  onRatingChange,
  onRemove,
}: ItemCardProps) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);

  const data = item.data;
  const Icon = TYPE_ICON[data.type];

  const handleAdd = async () => {
    if (!onAdd || adding || added) return;
    setAdding(true);
    try {
      await onAdd(data);
      setAdded(true);
    } finally {
      setAdding(false);
    }
  };

  const handleStatusChange = async (status: ItemStatus) => {
    if (item.kind !== "library" || !onStatusChange) return;
    setBusy(true);
    try {
      await onStatusChange(item.dbItemId, status);
    } finally {
      setBusy(false);
    }
  };

  const handleRatingChange = async (rating: number | null) => {
    if (item.kind !== "library" || !onRatingChange) return;
    setBusy(true);
    try {
      await onRatingChange(item.dbItemId, rating);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (item.kind !== "library" || !onRemove) return;
    setBusy(true);
    try {
      await onRemove(item.dbItemId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* Cover image */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
        {data.coverUrl ? (
          <Image
            src={data.coverUrl}
            alt={`Cover for ${data.title}`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/40">
            <Icon className="size-12" />
          </div>
        )}

        {/* Type badge */}
        <span
          className={`absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur-sm ${TYPE_COLOR[data.type]}`}
        >
          <Icon className="size-3" />
          {TYPE_LABEL[data.type]}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
            {data.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {data.year ?? "—"}
            {data.creators.length > 0 && ` · ${data.creators[0]}`}
          </p>
        </div>

        {/* Genres */}
        {data.genres.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {data.genres.slice(0, 3).map((g) => (
              <span
                key={g}
                className="rounded-full border border-border/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex flex-col gap-2 pt-1">
          {item.kind === "search" && (
            <button
              id={`add-${data.source}-${data.externalId}`}
              type="button"
              disabled={adding || added}
              onClick={handleAdd}
              className={`
                flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium
                transition-all duration-200
                disabled:cursor-not-allowed disabled:opacity-70
                ${added
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"}
              `}
            >
              {added ? (
                <>
                  <Check className="size-3.5" /> Added
                </>
              ) : adding ? (
                "Adding…"
              ) : (
                <>
                  <Plus className="size-3.5" /> Add to Library
                </>
              )}
            </button>
          )}

          {item.kind === "library" && (
            <>
              <StatusSelect
                id={`status-${item.dbItemId}`}
                value={item.userStatus}
                onChange={handleStatusChange}
                disabled={busy}
              />
              <div className="flex items-center justify-between">
                <RatingInput
                  id={`rating-${item.dbItemId}`}
                  value={item.userRating}
                  onChange={handleRatingChange}
                  disabled={busy}
                />
                <button
                  id={`remove-${item.dbItemId}`}
                  type="button"
                  disabled={busy}
                  onClick={handleRemove}
                  aria-label="Remove from library"
                  className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive disabled:cursor-not-allowed"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
