"use client";

import { cn } from "@/lib/utils";

export function Avatar({ name, className }: { name?: string | null; className?: string }) {
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-small font-medium text-accent-foreground",
        className
      )}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}
