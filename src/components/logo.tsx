import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="hsl(var(--primary))" />
      <path
        d="M8 21.5c2.4-5.2 5.1-9.6 8.2-13.2.5-.6 1.4-.6 1.9 0 1.8 2.1 3.4 4.6 4.9 7.3"
        fill="none"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="22.5" cy="18.2" r="2.3" fill="white" />
    </svg>
  );
}

export function Logo({
  href = "/",
  size = "md",
  inverted = false,
  className,
}: {
  href?: string;
  size?: "sm" | "md";
  inverted?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 font-semibold", inverted ? "text-sidebar-fg" : "text-foreground", className)}
      aria-label="LogoPed — на главную"
    >
      <LogoMark className={size === "sm" ? "h-7 w-7" : "h-8 w-8"} />
      <span className={size === "sm" ? "text-base" : "text-lg"}>LogoPed</span>
    </Link>
  );
}
