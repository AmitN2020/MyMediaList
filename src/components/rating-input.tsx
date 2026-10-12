"use client";

import { Star } from "lucide-react";

interface RatingInputProps {
  value: number | null;
  onChange: (rating: number | null) => void;
  disabled?: boolean;
  id?: string;
}

export function RatingInput({ value, onChange, disabled, id }: RatingInputProps) {
  return (
    <div id={id} className="flex items-center gap-0.5" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
          onClick={() => {
            // Clicking the same star again clears the rating
            onChange(value === star ? null : star);
          }}
          className={`
            rounded p-0.5 transition-colors
            disabled:cursor-not-allowed disabled:opacity-50
            focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
          `}
        >
          <Star
            className={`size-4 transition-colors ${
              value !== null && star <= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground hover:text-amber-400"
            }`}
          />
        </button>
      ))}
    </div>
  );
}
