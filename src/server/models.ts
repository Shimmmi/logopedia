import { Plan, ModelKind } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";
import { getPlan } from "./limits";

export const SUNBURST = "openai/gpt-image-2.5-sunburst";
export const JOB_NORM = { IMAGE: 8, TEXT: 12, ANALYSIS: 10 } as const;

export type CatalogKind = "TEXT" | "IMAGE";
export type CatalogRow = { id: string; kind: CatalogKind; priceLabel: string };

const SKIP_OUTPUT = new Set(["embeddings", "video", "transcription", "speech", "audio", "rerank", "decisions"]);
const SITE = "https://routerai.ru/models";
const CACHE_MS = 10 * 60 * 1000;

let catalogCache: { at: number; rows: CatalogRow[] } | null = null;

function rub(n: number) {
  if (n >= 100) return Math.round(n).toLocaleString("ru-RU");
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

export function kindFromOutputs(outputs: string[]): CatalogKind | null {
  const list = outputs.map((s) => s.toLowerCase());
  if (list.includes("image") || list.some((s) => s.includes("изображен"))) return "IMAGE";
  if (list.some((s) => SKIP_OUTPUT.has(s))) return null;
  if (list.includes("text") || list.some((s) => s === "текст" || s.includes("текст"))) return "TEXT";
  return null;
}

export function priceLabelOf(
  kind: CatalogKind,
  pricing?: Record<string, number> | null,
  units?: Record<string, string> | null,
) {
  if (!pricing) return "";
  if (kind === "IMAGE" && typeof pricing.image_output === "number") {
    const unit = units?.image_output;
    if (unit === "image") return `${rub(pricing.image_output)} ₽ / картинка`;
    return `${rub(pricing.image_output * 1_000_000)} ₽ / 1 млн токенов картинки`;
  }
  const prompt = typeof pricing.prompt === "number" ? pricing.prompt * 1_000_000 : null;
  const completion = typeof pricing.completion === "number" ? pricing.completion * 1_000_000 : null;
  if (prompt == null && completion == null) return "";
  return `${rub(prompt || 0)} / ${rub(completion || 0)} ₽ за 1 млн`;
}

export function rowsFromSiteHtml(html: string): CatalogRow[] {
  const rows: CatalogRow[] = [];
  const seen = new Set<string>();
  for (const card of html.split("model-card__title-link").slice(1)) {
    const href = card.match(/href="\/models\/([^"]+)"/)?.[1];
    if (!href) continue;
    const id = decodeURIComponent(href);
    const outputs = Array.from(card.matchAll(/model-card__badge_output'>([^<]+)/g)).map((m) => m[1].trim());
    const kind = kindFromOutputs(outputs);
    if (!kind || seen.has(id)) continue;
    seen.add(id);
    rows.push({ id, kind, priceLabel: "" });
  }
  return rows;
}

async function fetchText(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { Accept: "text/html" } });
  if (!res.ok) return "";
  return res.text();
}

async function siteCatalog() {
  const first = await fetchText(SITE);
  const rows = rowsFromSiteHtml(first);
  const last = Math.max(1, ...Array.from(first.matchAll(/models\?page=(\d+)/g)).map((m) => Number(m[1])));
  const pages: number[] = [];
  for (let page = 2; page <= Math.min(last, 80); page++) pages.push(page);
  for (let i = 0; i < pages.length; i += 6) {
    const chunk = pages.slice(i, i + 6);
    const htmls = await Promise.all(chunk.map((page) => fetchText(`${SITE}?page=${page}`).catch(() => "")));
    for (const html of htmls) rows.push(...rowsFromSiteHtml(html));
  }
  return rows;
}

async function apiCatalog() {
  if (!env.aiApiKey) return [] as CatalogRow[];
  const res = await fetch(`${env.aiBaseUrl.replace(/\/$/, "")}/models`, {
    headers: { Authorization: `Bearer ${env.aiApiKey}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: { id?: string; architecture?: { output_modalities?: string[] }; pricing?: Record<string, number>; pricing_units?: Record<string, string> }[];
  };
  const rows: CatalogRow[] = [];
  for (const model of data.data || []) {
    if (!model.id) continue;
    const kind = kindFromOutputs(model.architecture?.output_modalities || []);
    if (!kind) continue;
    rows.push({ id: model.id, kind, priceLabel: priceLabelOf(kind, model.pricing, model.pricing_units) });
  }
  return rows;
}

export async function loadCatalog(force = false) {
  if (!force && catalogCache && Date.now() - catalogCache.at < CACHE_MS) return catalogCache.rows;
  const [api, site] = await Promise.all([apiCatalog().catch(() => [] as CatalogRow[]), siteCatalog().catch(() => [] as CatalogRow[])]);
  const map = new Map<string, CatalogRow>();
  for (const row of site) map.set(row.id, row);
  for (const row of api) map.set(row.id, row);
  const rows = Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
  catalogCache = { at: Date.now(), rows };
  return rows;
}

async function hiddenIds(kind: ModelKind) {
  const rows = await prisma.modelCatalogHide.findMany({ where: { kind }, select: { modelId: true } });
  return new Set(rows.map((r) => r.modelId));
}

export async function ensurePlanModels() {
  const [hiddenText, hiddenImage] = await Promise.all([hiddenIds("TEXT"), hiddenIds("IMAGE")]);
  const text = env.aiModelBasic;
  const plans: Plan[] = ["FREE", "PRO", "PREMIUM"];
  for (const plan of plans) {
    if (text && !hiddenText.has(text)) {
      await prisma.planModelAllow.upsert({
        where: { plan_modelId_kind: { plan, modelId: text, kind: "TEXT" } },
        create: { plan, modelId: text, kind: "TEXT", isDefault: true, fallbackRub: JOB_NORM.TEXT },
        update: {},
      });
    }
    if (!hiddenImage.has(SUNBURST)) {
      const imageDefault = await prisma.planModelAllow.findFirst({ where: { plan, kind: "IMAGE", isDefault: true } });
      await prisma.planModelAllow.upsert({
        where: { plan_modelId_kind: { plan, modelId: SUNBURST, kind: "IMAGE" } },
        create: { plan, modelId: SUNBURST, kind: "IMAGE", isDefault: !imageDefault, fallbackRub: JOB_NORM.IMAGE },
        update: {},
      });
    }
  }
}

export async function hideCatalogModels(items: { modelId: string; kind: ModelKind }[]) {
  const unique = Array.from(new Map(items.map((item) => [`${item.kind}:${item.modelId}`, item])).values());
  if (!unique.length) return;
  await prisma.$transaction(async (tx) => {
    for (const item of unique) {
      await tx.modelCatalogHide.upsert({
        where: { modelId_kind: { modelId: item.modelId, kind: item.kind } },
        create: { modelId: item.modelId, kind: item.kind },
        update: {},
      });
    }
    await tx.planModelAllow.deleteMany({
      where: { OR: unique.map((item) => ({ modelId: item.modelId, kind: item.kind })) },
    });
    const textIds = unique.filter((item) => item.kind === "TEXT").map((item) => item.modelId);
    const imageIds = unique.filter((item) => item.kind === "IMAGE").map((item) => item.modelId);
    if (textIds.length) await tx.user.updateMany({ where: { textModel: { in: textIds } }, data: { textModel: null } });
    if (imageIds.length) await tx.user.updateMany({ where: { imageModel: { in: imageIds } }, data: { imageModel: null } });
  });
}

export async function hideCatalogModel(modelId: string, kind: ModelKind) {
  await hideCatalogModels([{ modelId, kind }]);
}

export async function restoreCatalogModel(modelId: string, kind: ModelKind) {
  await prisma.modelCatalogHide.deleteMany({ where: { modelId, kind } });
}

export async function resolveModel(userId: string, kind: ModelKind) {
  await ensurePlanModels();
  const plan = await getPlan(userId);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { textModel: true, imageModel: true } });
  const chosen = kind === "TEXT" ? user?.textModel : user?.imageModel;
  const rows = await prisma.planModelAllow.findMany({ where: { plan, kind } });
  if (chosen) {
    if (!rows.some((r) => r.modelId === chosen)) {
      throw Object.assign(new Error("Эта модель недоступна на вашем тарифе"), { status: 403 });
    }
    return chosen;
  }
  const def = rows.find((r) => r.isDefault) || rows[0];
  if (def) return def.modelId;
  const fallback = kind === "IMAGE" ? SUNBURST : env.aiModelBasic;
  const hidden = await prisma.modelCatalogHide.findFirst({ where: { kind, modelId: fallback } });
  if (hidden || !fallback) throw Object.assign(new Error("Нет доступной модели на тарифе"), { status: 403 });
  return fallback;
}

export function normFor(kind: ModelKind) {
  return kind === "IMAGE" ? JOB_NORM.IMAGE : JOB_NORM.TEXT;
}
