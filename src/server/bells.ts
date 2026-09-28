import { prisma } from "./db";

export type BellRow = { n: number; startMin: number; endMin: number };

export const DEFAULT_BELLS: BellRow[] = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
  n: i + 1,
  startMin: 8 * 60 + 30 + i * 50,
  endMin: 8 * 60 + 30 + i * 50 + 40,
}));

export function hhmm(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseMin(v: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export async function ensureDefaultBells(userId: string) {
  const n = await prisma.bellTemplate.count({ where: { userId } });
  if (n) return;
  await prisma.bellTemplate.create({
    data: { userId, name: "Основная", shift: 1, isDefault: true, lessons: DEFAULT_BELLS },
  });
}

export function bellsOf(raw: unknown): BellRow[] {
  if (!Array.isArray(raw)) return DEFAULT_BELLS;
  return raw
    .map((r) => {
      const o = r as { n?: number; startMin?: number; endMin?: number };
      if (!o.n || o.startMin == null || o.endMin == null) return null;
      return { n: o.n, startMin: o.startMin, endMin: o.endMin };
    })
    .filter((x): x is BellRow => !!x);
}
