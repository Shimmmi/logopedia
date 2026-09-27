import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Ошибка ${res.status}`);
  return data as T;
}

export { cn } from "./utils";
export type { ClassValue };
export { clsx, twMerge };
