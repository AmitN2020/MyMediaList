"use client";

import type { ItemStatus } from "@/lib/library-schemas";

const STATUS_LABELS: Record<ItemStatus, string> = {
  planned: "Plan to watch/read",
  in_progress: "In progress",
  completed: "Completed",
  dropped: "Dropped",
};

const STATUS_COLORS: Record<ItemStatus, string> = {
  planned: "text-blue-600 dark:text-blue-400",
  in_progress: "text-amber-600 dark:text-amber-400",
  completed: "text-green-600 dark:text-green-400",
  dropped: "text-muted-foreground",
};

interface StatusSelectProps {
  value: ItemStatus;
  onChange: (status: ItemStatus) => void;
  disabled?: boolean;
  id?: string;
}

export function StatusSelect({ value, onChange, disabled, id }: StatusSelectProps) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as ItemStatus)}
      className={`
        rounded-md border border-border bg-background px-2 py-1 text-xs font-medium
        focus:outline-none focus:ring-2 focus:ring-ring
        disabled:cursor-not-allowed disabled:opacity-50
        ${STATUS_COLORS[value]}
      `}
    >
      {(Object.keys(STATUS_LABELS) as ItemStatus[]).map((status) => (
        <option key={status} value={status}>
          {STATUS_LABELS[status]}
        </option>
      ))}
    </select>
  );
}

export { STATUS_LABELS, STATUS_COLORS };
