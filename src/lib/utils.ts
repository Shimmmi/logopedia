import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function periodKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} МБ`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} ГБ`;
}

export const EVENT_COLORS: Record<string, string> = {
  DIAGNOSTICS: "hsl(var(--event-diagnostics))",
  INDIVIDUAL: "hsl(var(--event-individual))",
  GROUP: "hsl(var(--event-group))",
  CONSULTATION: "hsl(var(--event-consultation))",
};

export const TAG_COLORS: Record<string, string> = {
  DIAGNOSIS: "#dc2626",
  DIRECTION: "#2563eb",
  ORGANIZATIONAL: "#ca8a04",
  CUSTOM: "#6b7280",
};

export { PLAN_LABELS } from "./labels";

export const SYSTEM_FOLDERS = [
  "Рабочие программы",
  "Заключения",
  "Диагностика",
  "Отчётность",
  "Методические материалы",
  "Шаблоны",
  "Прочее",
] as const;
